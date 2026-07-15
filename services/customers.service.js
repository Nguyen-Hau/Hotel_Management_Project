const CustomersModel = require('../models/customers.model');

function getCountryFromPhone(phone) {
    if (!phone) return 'Việt Nam';
    if (phone.startsWith('+1')) return 'Hoa Kỳ';
    if (phone.startsWith('+81')) return 'Nhật Bản';
    if (phone.startsWith('+82')) return 'Hàn Quốc';
    return 'Việt Nam';
}

const CustomersService = {
    getAll: async (user) => {
        if (user.role === 'customer') {
            const customer = await CustomersModel.findById(user.id);
            if (customer) {
                return [{
                    customer_id: customer.customer_id,
                    full_name: customer.full_name,
                    email: customer.email,
                    phone: customer.phone,
                    cccd: customer.cccd,
                    created_at: customer.created_at
                }];
            }
            return [];
        }
        return await CustomersModel.getAll();
    },

    getById: async (id, user) => {
        const customer = await CustomersModel.findById(id);
        if (!customer) {
            throw new Error('CUSTOMER_NOT_FOUND');
        }
        if (user.role === 'customer' && customer.customer_id != user.id) {
            throw new Error('FORBIDDEN');
        }
        return {
            customer_id: customer.customer_id,
            full_name: customer.full_name,
            email: customer.email,
            phone: customer.phone,
            cccd: customer.cccd,
            created_at: customer.created_at
        };
    },

    create: async (body) => {
        const { full_name, email, phone, cccd, password } = body;
        const country = getCountryFromPhone(phone);
        const pass = password || '123456';
        
        const insertId = await CustomersModel.create({
            full_name,
            email,
            phone,
            country,
            cccd,
            password: pass
        });
        return { success: true, message: 'Thêm khách hàng thành công', id: insertId };
    },

    update: async (id, body, user) => {
        if (user.role === 'customer' && id != user.id) {
            throw new Error('FORBIDDEN');
        }

        const { full_name, email, phone, cccd, password } = body;
        const country = getCountryFromPhone(phone);
        
        const hasPassword = !!password;
        await CustomersModel.update(id, {
            full_name,
            email,
            phone,
            country,
            cccd,
            password
        }, hasPassword);
        
        return { success: true, message: 'Cập nhật khách hàng thành công' };
    },

    remove: async (id, user) => {
        if (user.role !== 'Giám đốc') {
            throw new Error('FORBIDDEN');
        }
        const affectedRows = await CustomersModel.remove(id);
        if (affectedRows === 0) {
            throw new Error('CUSTOMER_NOT_FOUND');
        }
        return { success: true, message: 'Xóa thông tin khách hàng thành công' };
    }
};

module.exports = CustomersService;
