const AuthModel = require('../models/auth.model');
const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET || "hotel_management_secret_key_2026";

function getCountryFromPhone(phone) {
    if (!phone) return "Việt Nam";
    if (phone.startsWith("+1")) return "Hoa Kỳ";
    if (phone.startsWith("+81")) return "Nhật Bản";
    if (phone.startsWith("+82")) return "Hàn Quốc";
    return "Việt Nam";
}

function createTokenPayload(user, type) {
    const payload = {
        id: user.employee_id || user.customer_id || user.id,
        full_name: user.full_name,
        role: user.role || "customer",
        type: type,
    };

    if (type === "employee") {
        payload.username = user.username;
    } else {
        payload.email = user.email;
        payload.phone = user.phone;
        payload.country = user.country;
    }
    return payload;
}

const AuthService = {
    login: async (username, password) => {
        if (!username || !password) {
            throw new Error('MISSING_USERNAME_PASSWORD');
        }

        // 1. Kiểm tra nhân viên
        const employee = await AuthModel.findEmployeeByUsername(username);
        if (employee) {
            if (employee.status === "locked") {
                throw new Error('ACCOUNT_LOCKED');
            }
            if (password === employee.password) {
                const payload = createTokenPayload(employee, "employee");
                const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "24h" });
                return { 
                    success: true, 
                    message: "Đăng nhập thành công (Nhân viên)", 
                    token, 
                    user: payload 
                };
            }
        }

        // 2. Kiểm tra khách hàng
        const customer = await AuthModel.findCustomerByEmailOrPhone(username);
        if (customer) {
            if (password === customer.password) {
                const payload = createTokenPayload(customer, "customer");
                const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "24h" });
                return { 
                    success: true, 
                    message: "Đăng nhập thành công (Khách hàng)", 
                    token, 
                    user: payload 
                };
            }
        }

        throw new Error('INVALID_CREDENTIALS');
    },

    register: async (body) => {
        const { full_name, email, phone, password, cccd } = body;
        if (!full_name || !email || !phone || !password) {
            throw new Error('MISSING_FIELDS');
        }

        const isExist = await AuthModel.checkCustomerExists(email, phone);
        if (isExist) {
            throw new Error('EMAIL_PHONE_EXISTS');
        }

        const country = getCountryFromPhone(phone);
        const insertId = await AuthModel.registerCustomer({
            full_name,
            email,
            phone,
            country,
            cccd,
            password
        });

        const userData = {
            id: insertId,
            full_name,
            email,
            phone,
            country
        };

        const payload = createTokenPayload(userData, "customer");
        const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "24h" });

        return { success: true, message: "Đăng ký tài khoản thành công", token, user: payload };
    }
};

module.exports = AuthService;
