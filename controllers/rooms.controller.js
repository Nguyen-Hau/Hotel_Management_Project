const db = require('../config/db');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');


function errRes(res, msg, err) {
    console.error(msg, err);
    let chiTietLoi = '';
    if (err && err.message) {
        chiTietLoi = ': ' + err.message;
    }
    return res.status(500).json({ message: msg + chiTietLoi });
}

function delImg(img) {
    if (img) {
        const pth = path.join(__dirname, '../../uploads', path.basename(img));
        if (fs.existsSync(pth)) {
            fs.unlinkSync(pth);
        }
    }
}

async function getAll(req, res) {
    try {
        const [rooms] = await db.query('SELECT * FROM rooms ORDER BY room_number');
        return res.json(rooms);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy danh sách phòng', err);
    }
}

async function getById(req, res) {
    try {
        const [room] = await db.query('SELECT * FROM rooms WHERE room_id = ?', [req.params.id]);
        if (room.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin phòng này' });
        }
        return res.json(room[0]);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy thông tin phòng', err);
    }
}

async function create(req, res) {
    try {
        const { room_number, room_type, price, services, status } = req.body;
        let image = null;
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        }
        
        const roomStatus = status || 'available';
        const [result] = await db.query(
            'INSERT INTO rooms (room_number, room_type, price, image, services, status) VALUES (?, ?, ?, ?, ?, ?)', 
            [room_number, room_type, price, image, services, roomStatus]
        );
        return res.json({ success: true, message: 'Thêm phòng mới thành công', id: result.insertId });
    } catch (err) {
        return errRes(res, 'Lỗi khi thêm phòng', err);
    }
}

async function update(req, res) {
    try {
        const { room_number, room_type, price, services, status } = req.body;
        let image = req.body.image;
        
        if (req.file) {
            const [old] = await db.query('SELECT image FROM rooms WHERE room_id = ?', [req.params.id]);
            if (old.length > 0) {
                delImg(old[0].image);
            }
            image = `/uploads/${req.file.filename}`;
        }
        
        await db.query(
            'UPDATE rooms SET room_number = ?, room_type = ?, price = ?, image = ?, services = ?, status = ? WHERE room_id = ?', 
            [room_number, room_type, price, image, services, status, req.params.id]
        );
        return res.json({ success: true, message: 'Cập nhật phòng thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi cập nhật thông tin phòng', err);
    }
}

async function remove(req, res) {
    try {
        const [room] = await db.query('SELECT image FROM rooms WHERE room_id = ?', [req.params.id]);
        if (room.length > 0) {
            delImg(room[0].image);
        }
        
        await db.query('DELETE FROM rooms WHERE room_id = ?', [req.params.id]);
        return res.json({ success: true, message: 'Xóa phòng thành công' });
    } catch (err) {
        return errRes(res, 'Lỗi khi xóa phòng', err);
    }
}

// Hàm cập nhật danh sách phòng từ file Excel
async function importExcel(req, res) {
    // Kiểm tra xem người dùng đã tải file lên chưa
    if (!req.file) {
        return res.status(400).json({ message: 'Vui lòng chọn file Excel để tải lên' });
    }

    const filePath = req.file.path;
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
            // Lấy dữ liệu theo tên cột tương ứng trong file Excel mẫu
            let roomNumber = row['Số phòng'] || row['room_number'];
            let roomType = row['Loại phòng'] || row['room_type'];
            let price = row['Giá phòng'] || row['price'];
            let status = row['Trạng thái'] || row['status'] || 'available';

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
        return res.json({
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
        return errRes(res, 'Lỗi hệ thống khi xử lý dữ liệu từ file Excel', err);
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