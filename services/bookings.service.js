const db = require('../config/db');
const BookingsModel = require('../models/bookings.model');
const RoomsModel = require('../models/rooms.model');
const CustomersModel = require('../models/customers.model');
const auditService = require('./audit.service');

const BookingsService = {
    getAll: async (user) => {
        const bookings = await BookingsModel.getAll(user.role, user.id);
        for (let b of bookings) {
            b.total_amount = await BookingsModel.getInvoiceTotalByBooking(b.booking_id);
        }
        return bookings;
    },

    getById: async (id, user) => {
        const b = await BookingsModel.findById(id);
        if (!b) {
            throw new Error('BOOKING_NOT_FOUND');
        }
        if (user.role === 'customer' && b.customer_id !== user.id) {
            throw new Error('FORBIDDEN');
        }
        return b;
    },

    create: async (user, body) => {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            let room_ids = body.room_ids;
            if (!Array.isArray(room_ids)) {
                room_ids = body.room_id ? [body.room_id] : [];
            }

            let check_in = body.check_in;
            let check_out = body.check_out;

            let customer_id = body.customer_id;
            if (user.role === 'customer') {
                customer_id = user.id;
            }

            if (!customer_id) throw new Error('CUSTOMER_ID_MISSING');
            if (room_ids.length === 0) throw new Error('ROOM_IDS_EMPTY');

            const queryCheckOut = check_out || new Date(new Date(check_in).getTime() + 86400000).toISOString().split('T')[0];

            for (let r_id of room_ids) {
                const rm = await RoomsModel.findById(r_id, conn);
                if (!rm) throw new Error('ROOM_NOT_FOUND');
                if (rm.status === 'maintenance') {
                    throw new Error(`ROOM_MAINTENANCE_${rm.room_number}`);
                }

                // Check overlaps
                const overlapping = await BookingsModel.getOverlapping(r_id, check_in, queryCheckOut, null, conn);
                if (overlapping.length > 0) {
                    const formatD = d => new Date(d).toLocaleDateString('vi-VN');
                    throw new Error(`ROOM_OVERLAP_${rm.room_number}_${formatD(overlapping[0].check_in)}_${formatD(overlapping[0].check_out)}_${overlapping[0].full_name}`);
                }
            }

            let nights = null;
            if (check_in && check_out) {
                nights = Math.max(1, Math.ceil((new Date(check_out) - new Date(check_in)) / 86400000));
            }

            const booking_group_id = room_ids.length > 1 ? `GRP-${Date.now()}-${Math.floor(Math.random() * 1000)}` : null;
            let firstInsertedId = null;

            for (let r_id of room_ids) {
                const insertId = await BookingsModel.create(customer_id, r_id, check_in, check_out, nights, booking_group_id, conn);
                if (!firstInsertedId) firstInsertedId = insertId;

                const todayStr = new Date().toISOString().split('T')[0];
                if (check_in <= todayStr && (!check_out || check_out > todayStr)) {
                    await RoomsModel.updateStatus(r_id, 'booked', conn);
                }
            }

            await conn.commit();
            return { success: true, message: 'Đặt phòng thành công', booking_id: firstInsertedId };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    checkIn: async (id, body) => {
        const b = await BookingsModel.findById(id);
        if (!b) throw new Error('BOOKING_NOT_FOUND');
        if (b.status !== 'booked') throw new Error('INVALID_STATUS');

        const { full_name, phone, cccd, check_in_group } = body;
        if (!full_name || !phone || !cccd) throw new Error('INCOMPLETE_INFO');

        const cleanStr = s => (s || '').toString().trim().toLowerCase();
        if (cleanStr(b.customer_name) !== cleanStr(full_name)) throw new Error('NAME_MISMATCH');
        if (cleanStr(b.phone) !== cleanStr(phone)) throw new Error('PHONE_MISMATCH');
        if (b.cccd && cleanStr(b.cccd) !== cleanStr(cccd)) throw new Error('CCCD_MISMATCH');

        if (!b.cccd) {
            await db.query('UPDATE customers SET cccd = ? WHERE customer_id = ?', [cccd.trim(), b.customer_id]);
        }

        if (check_in_group && b.booking_group_id) {
            const gbs = await BookingsModel.getBookingGroup(b.booking_group_id, 'booked');
            for (let gb of gbs) {
                await BookingsModel.updateStatus(gb.booking_id, 'checked_in');
                await RoomsModel.updateStatus(gb.room_id, 'checked_in');
            }
        } else {
            await BookingsModel.updateStatus(id, 'checked_in');
            await RoomsModel.updateStatus(b.room_id, 'checked_in');
        }
        return { success: true, message: 'Check-in thành công' };
    },

    checkOut: async (request, id, body) => {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            const b = await BookingsModel.findById(id, conn);
            if (!b) throw new Error('BOOKING_NOT_FOUND');
            if (b.status !== 'checked_in') throw new Error('INVALID_STATUS');

            const checkout_group = body.checkout_group;
            const surcharges = body.surcharges;
            const checkin_early = Number(surcharges?.checkin_early || 0);
            const checkout_late = Number(surcharges?.checkout_late || 0);
            const extra_people = Number(surcharges?.extra_people || 0);
            const extra_bed = Number(surcharges?.extra_bed || 0);
            const surcharge_description = surcharges?.description || '';
            const surcharge_total = checkin_early + checkout_late + extra_people + extra_bed;

            let bookingsToCheckOut = [b];

            if (checkout_group && b.booking_group_id) {
                const gbs = await BookingsModel.getBookingGroup(b.booking_group_id, 'checked_in', conn);
                if (gbs.length > 0) {
                    bookingsToCheckOut = gbs;
                }
            }

            let totalGroupAmount = 0;
            let invoiceIds = [];

            for (let booking of bookingsToCheckOut) {
                let nights = booking.total_nights;
                if (!nights) {
                    let outDate = booking.check_out ? new Date(booking.check_out) : new Date();
                    nights = Math.max(1, Math.ceil((outDate - new Date(booking.check_in)) / 86400000));
                }

                const serviceTotal = await BookingsModel.getServicesTotalAmount(booking.booking_id, conn);

                let rmAmt = nights * booking.room_price;
                let svAmt = serviceTotal;
                let total = rmAmt + svAmt + surcharge_total;
                totalGroupAmount += total;

                await BookingsModel.updateStatusAndNights(booking.booking_id, 'checked_out', nights, conn);
                await RoomsModel.updateStatus(booking.room_id, 'dirty', conn);

                const invId = await BookingsModel.updateInvoice(booking.booking_id, rmAmt, svAmt, total, {
                    checkin_early,
                    checkout_late,
                    extra_people,
                    extra_bed,
                    description: surcharge_description
                }, conn);
                
                invoiceIds.push(invId);
            }

            await conn.commit();

            // Ghi nhận lịch sử audit log
            for (let booking of bookingsToCheckOut) {
                await auditService.logAction(request, 'CHECK_OUT_BOOKING', 'bookings', booking.booking_id, 
                    { status: 'checked_in' }, 
                    { status: 'checked_out', surcharges: { checkin_early, checkout_late, extra_people, extra_bed } }
                );
            }

            return {
                success: true,
                message: 'Check-out thành công',
                invoice_id: invoiceIds[0],
                invoice_ids: invoiceIds,
                total: totalGroupAmount
            };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    cancel: async (request, id) => {
        const b = await BookingsModel.findById(id);
        if (!b) throw new Error('BOOKING_NOT_FOUND');

        if (request.user.role === 'customer' && b.customer_id !== request.user.id) {
            throw new Error('FORBIDDEN');
        }
        if (b.status !== 'booked') throw new Error('INVALID_STATUS');

        await BookingsModel.updateStatus(id, 'cancelled');
        await RoomsModel.updateStatus(b.room_id, 'available');

        // Ghi nhận log
        await auditService.logAction(request, 'CANCEL_BOOKING', 'bookings', id, 
            { status: b.status }, 
            { status: 'cancelled' }
        );

        return { success: true, message: 'Hủy đặt phòng thành công' };
    },

    extend: async (user, id, body) => {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            const bookingId = id;
            const new_check_out = body.new_check_out;

            if (!new_check_out) throw new Error('CHECK_OUT_MISSING');

            const booking = await BookingsModel.findById(bookingId, conn);
            if (!booking) throw new Error('BOOKING_NOT_FOUND');

            if (booking.status !== 'booked' && booking.status !== 'checked_in') {
                throw new Error('INVALID_STATUS');
            }

            if (user.role === 'customer' && booking.customer_id !== user.id) {
                throw new Error('FORBIDDEN');
            }

            const checkInDate = new Date(booking.check_in);
            const originalCheckOutDate = booking.check_out ? new Date(booking.check_out) : new Date(checkInDate.getTime() + 86400000);
            const newCheckOutDate = new Date(new_check_out);

            if (newCheckOutDate <= checkInDate) throw new Error('CHECK_OUT_BEFORE_CHECK_IN');
            if (newCheckOutDate <= originalCheckOutDate) throw new Error('CHECK_OUT_BEFORE_ORIGINAL');

            // Check overlaps
            const overlapping = await BookingsModel.getOverlapping(booking.room_id, booking.check_out, new_check_out, bookingId, conn);
            if (overlapping.length > 0) {
                const formatD = d => new Date(d).toLocaleDateString('vi-VN');
                throw new Error(`ROOM_OVERLAP_${booking.room_number}_${formatD(overlapping[0].check_in)}_${formatD(overlapping[0].check_out)}_${overlapping[0].full_name}`);
            }

            const nights = Math.max(1, Math.ceil((newCheckOutDate - checkInDate) / 86400000));
            await BookingsModel.extend(bookingId, new_check_out, nights, conn);

            await conn.commit();
            return { success: true, message: 'Gia hạn phòng thành công', new_check_out, total_nights: nights };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }
};

module.exports = BookingsService;
