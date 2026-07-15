const DashboardModel = require('../models/dashboard.model');

const DashboardService = {
    getDashboard: async (user) => {
        const role = user.role;
        const cId = user.id;
        const isStaff = ['Giám đốc', 'Quản lý', 'Lễ tân'].includes(role);

        const roomCounts = await DashboardModel.getRoomsCount();
        const customerCounts = await DashboardModel.getCustomersCount();

        const bayGio = new Date();
        const nam = bayGio.getFullYear();
        const thang = String(bayGio.getMonth() + 1).padStart(2, '0');
        const ngay = String(bayGio.getDate()).padStart(2, '0');
        const chuoiNgayHomNay = nam + '-' + thang + '-' + ngay; 

        const todayRevenue = await DashboardModel.getRevenueToday(chuoiNgayHomNay);
        const monthRevenue = await DashboardModel.getRevenueMonth(Number(thang), nam);

        const totalRooms = roomCounts.total;
        const occupiedRooms = roomCounts.occupied;
        const bookedRooms = roomCounts.booked;

        let occupancyRate = 0;
        if (totalRooms > 0) {
            occupancyRate = Math.round(((occupiedRooms + bookedRooms) / totalRooms) * 100);
        }

        const stats = {
            totalRooms: totalRooms,
            availableRooms: roomCounts.available,
            occupiedRooms: occupiedRooms,
            bookedRooms: bookedRooms,
            maintenanceRooms: roomCounts.maintenance,
            avgPrice: roomCounts.avgPrice,
            totalCustomers: customerCounts.total,
            currentGuests: customerCounts.currentGuests,
            todayRevenue: todayRevenue,
            monthRevenue: monthRevenue,
            occupancyRate: occupancyRate
        };

        if (isStaff) {
            stats.revenueTrend = await DashboardModel.getRevenueTrend();
            
            const structure = await DashboardModel.getRevenueStructure();
            stats.roomRevenue = structure ? structure.room : 0;
            stats.serviceRevenue = structure ? structure.service : 0;
            stats.surchargeRevenue = structure ? structure.surcharge : 0;

            const occMonth = await DashboardModel.getOccupancyMonth();
            const listOccupancy = [];
            for (let i = 0; i < occMonth.length; i++) {
                listOccupancy.push({
                    month: occMonth[i].month,
                    rate: Math.round((occMonth[i].occ / occMonth[i].total) * 100)
                });
            }
            stats.occupancyByMonth = listOccupancy;
            stats.roomTypePopularity = await DashboardModel.getRoomTypePopularity();
            stats.bookingTrend = await DashboardModel.getBookingTrend();
            stats.topNationalities = await DashboardModel.getTopNationalities();
        }

        if (role === 'customer') {
            const cust = await DashboardModel.getCustomerStats(cId);
            stats.myBookings = cust.myBookings;
            stats.unpaidInvoices = cust.unpaidInvoices;
            stats.totalSpent = cust.totalSpent || 0;
        }

        return stats;
    },

    getRecentActivities: async () => {
        return await DashboardModel.getRecentActivities();
    },

    getCustomRevenue: async (start, end) => {
        if (!start || !end) {
            throw new Error('PARAMS_MISSING');
        }
        const summary = await DashboardModel.getCustomRevenueSummary(start, end);
        const invoices = await DashboardModel.getCustomRevenueInvoices(start, end);

        return {
            success: true,
            summary: summary,
            invoices: invoices
        };
    },

    getAuditLogs: async () => {
        return await DashboardModel.getAuditLogs();
    }
};

module.exports = DashboardService;
