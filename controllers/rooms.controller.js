const db = require('../config/db');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// 2. Xóa ảnh cũ khi update ảnh mới
function deleteImg(img) {
    if (img) { // Kiểm tra xem có ảnh không
        // Đường dẫn đầy đủ đến file ảnh cần xóa
        const pth = path.join(__dirname, '../../uploads', path.basename(img));
        if (fs.existsSync(pth)) { // Kiểm tra xem có tồn tại file không
            fs.unlinkSync(pth); // Xóa file
        }
    }
}

// 3. Lấy tất cả phòng để thực hiện nghiệp vụ check-in, check-out xử lý lọc phòng trống trong ngày 
async function getAll(request, response) {
    try {
        // Lấy dữ liệu từ query string
        const { check_in, check_out } = request.query;
        // Nếu có check_in thì lấy danh sách phòng không bị trùng với thời gian check_in và check_out
        // Nếu không có check_in thì lấy danh sách tất cả các phòng
        if (check_in) { // Kiểm tra xem có check_in không
            // Nếu không có check_out thì mặc định là check_in + 1 ngày
            const queryCheckOut = check_out || new Date(new Date(check_in).getTime() + 86400000).toISOString().split('T')[0];
            // Lấy danh sách phòng không bị trùng với thời gian check_in và check_out
            const [rooms] = await db.query(
                `SELECT r.* FROM rooms r 
                 WHERE r.status != 'maintenance' 
                   AND r.room_id NOT IN (
                       SELECT b.room_id FROM bookings b 
                       WHERE b.status IN ('booked', 'checked_in') 
                         AND IFNULL(b.check_out, DATE_ADD(b.check_in, INTERVAL 1 DAY)) > ? 
                         AND b.check_in < ?
                   )
                 ORDER BY r.room_number`,
                [check_in, queryCheckOut]
            );
            return response.json(rooms);
        } else {
            // Lấy danh sách tất cả các phòng dùng SELECT * FROM rooms
            const [rooms] = await db.query('SELECT * FROM rooms ORDER BY room_number');
            return response.json(rooms); // trả ra dữ liệu các rooms
        }
    } catch (err) {
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 4. Lấy thông tin phòng theo id
async function getById(request, response) {
    try {
        const [room] = await db.query('SELECT * FROM rooms WHERE room_id = ?', [request.params.id]);
        if (room.length === 0) {
            return response.status(404).json({ message: 'Không tìm thấy thông tin phòng này' });
        }
        return response.json(room[0]);
    } catch (err) {
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}


// 5. Thêm phòng mới
async function create(request, response) {
    try {
        const { room_number, room_type, price, services, status } = request.body;
        let image = null;
        if (request.file) {
            image = `/uploads/${request.file.filename}`;
        }

        const roomStatus = status || 'available';
        const [result] = await db.query(
            'INSERT INTO rooms (room_number, room_type, price, image, services, status) VALUES (?, ?, ?, ?, ?, ?)',
            [room_number, room_type, price, image, services, roomStatus]
        );
        return response.json({ success: true, message: 'Thêm phòng mới thành công', id: result.insertId });
    } catch (err) {
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// 6. Cập nhật thông tin phòng
async function update(request, response) {
    try {
        const { room_number, room_type, price, services, status } = request.body;
        let image = request.body.image;

        if (request.file) {
            const [old] = await db.query('SELECT image FROM rooms WHERE room_id = ?', [request.params.id]);
            if (old.length > 0) {
                deleteImg(old[0].image);
            }
            image = `/uploads/${request.file.filename}`;
        }

        await db.query(
            'UPDATE rooms SET room_number = ?, room_type = ?, price = ?, image = ?, services = ?, status = ? WHERE room_id = ?',
            [room_number, room_type, price, image, services, status, request.params.id]
        );
        return response.json({ success: true, message: 'Cập nhật phòng thành công' });
    } catch (err) {
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống" + err.message
        });
    }
}

// 7. Xóa phòng
async function remove(request, response) {
    try {
        const [room] = await db.query('SELECT image FROM rooms WHERE room_id = ?', [request.params.id]);

        if (room.length > 0) {
            deleteImg(room[0].image);
        }

        await db.query('DELETE FROM rooms WHERE room_id = ?', [request.params.id]);
        return response.json({ success: true, message: 'Xóa phòng thành công' });
    } catch (err) {
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

// Hàm cập nhật danh sách phòng từ file Excel
async function importExcel(request, response) {
    // Kiểm tra xem người dùng đã tải file lên chưa
    if (!request.file) {
        return response.status(400).json({ message: 'Vui lòng chọn file Excel để tải lên' });
    }

    const filePath = request.file.path;
    let thanhCong = 0;
    let capNhat = 0;
    let loi = 0;

    try {
        // Đọc file Excel từ đường dẫn tạm
        const workbook = xlsx.readFile(filePath);
        // Lấy tên của Sheet đầu tiên trong file
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Chuyển đổi dữ liệu trong sheet thành mảng JSON để dễ xử lý
        const excelData = xlsx.utils.sheet_to_json(worksheet);

        // Duyệt qua từng hàng dữ liệu của file Excel bằng vòng lặp
        for (let row of excelData) {
            // Bỏ qua dòng chỉ định phân tách (sep=,) của Excel nếu có
            if (row['STT'] === 'sep=,' || row['sep=,'] !== undefined || String(row['Số phòng']).includes('sep=')) {
                continue;
            }

            // Lấy dữ liệu theo tên cột tương ứng trong file Excel mẫu
            let roomNumber = row['Số phòng'] || row['room_number'];
            let roomType = row['Loại phòng'] || row['room_type'];
            let price = row['Giá phòng'] || row['price'] || row['Giá/đêm'];

            // Xử lý chuẩn hóa trạng thái từ tiếng Việt sang mã DB
            let statusRaw = row['Trạng thái'] || row['status'] || 'available';
            let status = 'available';
            statusRaw = String(statusRaw).trim();
            if (statusRaw === 'Trống' || statusRaw === 'available') status = 'available';
            else if (statusRaw === 'Đang ở' || statusRaw === 'checked_in') status = 'checked_in';
            else if (statusRaw === 'Đã đặt' || statusRaw === 'booked') status = 'booked';
            else if (statusRaw === 'Bảo trì' || statusRaw === 'maintenance') status = 'maintenance';
            else status = statusRaw;

            // Nếu hàng đó trống số phòng hoặc loại phòng thì bỏ qua dòng đó
            if (!roomNumber || !roomType) {
                loi++;
                continue;
            }

            // Kiểm tra xem số phòng này đã tồn tại trong database chưa
            const [exist] = await db.query('SELECT room_id FROM rooms WHERE room_number = ?', [roomNumber]);

            if (exist.length > 0) {
                // Nếu đã tồn tại số phòng: Tiến hành cập nhật lại loại phòng và giá cả mới
                await db.query(
                    'UPDATE rooms SET room_type = ?, price = ?, status = ? WHERE room_number = ?',
                    [roomType, price || 0, status, roomNumber]
                );
                capNhat++;
            } else {
                // Nếu chưa tồn tại: Thực hiện thêm mới phòng vào hệ thống
                await db.query(
                    'INSERT INTO rooms (room_number, room_type, price, status) VALUES (?, ?, ?, ?)',
                    [roomNumber, roomType, price || 0, status]
                );
                thanhCong++;
            }
        }

        // Xóa file Excel tạm thời sau khi đã xử lý xong để tránh rác server
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Trả kết quả thống kê chi tiết về cho phía giao diện hiển thị
        return response.json({
            success: true,
            message: 'Xử lý file Excel hoàn tất!',
            details: {
                inserted: thanhCong,
                updated: capNhat,
                failed: loi
            }
        });

    } catch (err) {
        // Nếu có lỗi xảy ra, đảm bảo xóa file tạm để không bị kẹt ổ cứng
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return response.status(500).json({
            success: false,
            message: "Lỗi hệ thống: " + err.message
        });
    }
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    importExcel
};