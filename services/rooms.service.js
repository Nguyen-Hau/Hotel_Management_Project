const RoomsModel = require('../models/rooms.model');
const auditService = require('./audit.service');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function deleteImg(img) {
    if (img) {
        const pth = path.join(__dirname, '../../uploads', path.basename(img));
        if (fs.existsSync(pth)) {
            fs.unlinkSync(pth);
        }
    }
}

const RoomsService = {
    getAll: async (query) => {
        const { check_in, check_out } = query;
        if (check_in) {
            const queryCheckOut = check_out || new Date(new Date(check_in).getTime() + 86400000).toISOString().split('T')[0];
            return await RoomsModel.getAvailable(check_in, queryCheckOut);
        } else {
            return await RoomsModel.getAll();
        }
    },

    getById: async (id) => {
        const room = await RoomsModel.findById(id);
        if (!room) {
            throw new Error('ROOM_NOT_FOUND');
        }
        return room;
    },

    create: async (body, file) => {
        const { room_number, room_type, price, services, status } = body;
        let image = null;
        if (file) {
            image = `/uploads/${file.filename}`;
        }
        const roomStatus = status || 'available';
        
        const insertId = await RoomsModel.create({
            room_number,
            room_type,
            price,
            image,
            services,
            status: roomStatus
        });
        return { success: true, message: 'Thêm phòng mới thành công', id: insertId };
    },

    update: async (request, id, body, file) => {
        const { room_number, room_type, price, services, status } = body;
        let image = body.image;

        const oldRoom = await RoomsModel.findById(id);
        if (!oldRoom) {
            throw new Error('ROOM_NOT_FOUND');
        }

        if (file) {
            deleteImg(oldRoom.image);
            image = `/uploads/${file.filename}`;
        }

        await RoomsModel.update(id, {
            room_number,
            room_type,
            price,
            image,
            services,
            status
        });

        // Ghi log hoạt động
        const oldLogData = {
            room_number: oldRoom.room_number,
            room_type: oldRoom.room_type,
            price: oldRoom.price,
            status: oldRoom.status
        };
        await auditService.logAction(request, 'UPDATE_ROOM', 'rooms', id, oldLogData, { room_number, room_type, price, status });

        return { success: true, message: 'Cập nhật phòng thành công' };
    },

    remove: async (id) => {
        const room = await RoomsModel.findById(id);
        if (!room) {
            throw new Error('ROOM_NOT_FOUND');
        }
        deleteImg(room.image);
        await RoomsModel.remove(id);
        return { success: true, message: 'Xóa phòng thành công' };
    },

    importExcel: async (file) => {
        if (!file) {
            throw new Error('FILE_MISSING');
        }
        const filePath = file.path;
        let thanhCong = 0;
        let capNhat = 0;
        let loi = 0;

        try {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const excelData = xlsx.utils.sheet_to_json(worksheet);

            for (let row of excelData) {
                if (row['STT'] === 'sep=,' || row['sep=,'] !== undefined || String(row['Số phòng']).includes('sep=')) {
                    continue;
                }

                let roomNumber = row['Số phòng'] || row['room_number'];
                let roomType = row['Loại phòng'] || row['room_type'];
                let price = row['Giá phòng'] || row['price'] || row['Giá/đêm'];

                let statusRaw = row['Trạng thái'] || row['status'] || 'available';
                let status = 'available';
                statusRaw = String(statusRaw).trim();
                if (statusRaw === 'Trống' || statusRaw === 'available') status = 'available';
                else if (statusRaw === 'Đang ở' || statusRaw === 'checked_in') status = 'checked_in';
                else if (statusRaw === 'Đã đặt' || statusRaw === 'booked') status = 'booked';
                else if (statusRaw === 'Bảo trì' || statusRaw === 'maintenance') status = 'maintenance';
                else status = statusRaw;

                if (!roomNumber || !roomType) {
                    loi++;
                    continue;
                }

                const exist = await RoomsModel.findByRoomNumber(roomNumber);
                if (exist) {
                    await RoomsModel.updateBasicFromExcel(roomNumber, roomType, price || 0, status);
                    capNhat++;
                } else {
                    await RoomsModel.insertFromExcel(roomNumber, roomType, price || 0, status);
                    thanhCong++;
                }
            }

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            return {
                success: true,
                message: 'Xử lý file Excel hoàn tất!',
                details: {
                    inserted: thanhCong,
                    updated: capNhat,
                    failed: loi
                }
            };
        } catch (err) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw err;
        }
    },

    getHousekeepingRooms: async () => {
        return await RoomsModel.getHousekeeping();
    },

    startCleaning: async (request, id) => {
        const room = await RoomsModel.findById(id);
        if (!room) {
            throw new Error('ROOM_NOT_FOUND');
        }
        if (room.status !== 'dirty') {
            throw new Error('INVALID_STATUS_DIRTY');
        }

        await RoomsModel.updateStatus(id, 'cleaning');
        await auditService.logAction(request, 'ROOM_CLEAN_START', 'rooms', id, { status: 'dirty' }, { status: 'cleaning' });

        return { success: true, message: 'Bắt đầu dọn phòng ' + room.room_number };
    },

    finishCleaning: async (request, id) => {
        const room = await RoomsModel.findById(id);
        if (!room) {
            throw new Error('ROOM_NOT_FOUND');
        }
        if (room.status !== 'cleaning') {
            throw new Error('INVALID_STATUS_CLEANING');
        }

        await RoomsModel.updateStatus(id, 'inspected');
        await auditService.logAction(request, 'ROOM_CLEAN_FINISH', 'rooms', id, { status: 'cleaning' }, { status: 'inspected' });

        return { success: true, message: 'Đã hoàn thành dọn phòng ' + room.room_number + ', chờ kiểm tra' };
    },

    confirmCleaned: async (request, id) => {
        const room = await RoomsModel.findById(id);
        if (!room) {
            throw new Error('ROOM_NOT_FOUND');
        }
        if (room.status !== 'inspected' && room.status !== 'dirty' && room.status !== 'cleaning') {
            throw new Error('INVALID_STATUS_CONFIRM');
        }

        const oldStatus = room.status;
        await RoomsModel.updateStatus(id, 'available');
        await auditService.logAction(request, 'ROOM_CLEAN_CONFIRMED', 'rooms', id, { status: oldStatus }, { status: 'available' });

        return { success: true, message: 'Xác nhận phòng ' + room.room_number + ' sạch sẽ, sẵn sàng sử dụng' };
    }
};

module.exports = RoomsService;
