const EmployeesModel = require('../models/employees.model');
const bcrypt = require('bcryptjs');

const UsersService = {
    getAllUsers: async () => {
        return await EmployeesModel.getAll();
    },

    getUserById: async (id) => {
        const user = await EmployeesModel.findById(id);
        if (!user) throw new Error('USER_NOT_FOUND');
        return user;
    },

    createUser: async (body) => {
        const { full_name, username, password, role, status } = body;
        if (!full_name || !username || !password || !role) {
            throw new Error('MISSING_FIELDS');
        }

        const exist = await EmployeesModel.findByUsername(username);
        if (exist) {
            throw new Error('USERNAME_ALREADY_EXISTS');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const insertId = await EmployeesModel.create({
            full_name,
            username,
            password: hashedPassword,
            role,
            status: status || 'active'
        });

        return { success: true, message: 'Tạo tài khoản người dùng thành công', id: insertId };
    },

    updateUser: async (id, body) => {
        const { full_name, username, role, password, status } = body;

        let hasPassword = false;
        let pass = null;
        if (password && password.trim() !== "") {
            hasPassword = true;
            pass = await bcrypt.hash(password, 10);
        }

        const affectedRows = await EmployeesModel.update(id, {
            full_name,
            username,
            role,
            status,
            password: pass
        }, hasPassword);

        if (affectedRows === 0) {
            throw new Error('USER_NOT_FOUND');
        }

        return { success: true, message: 'Cập nhật tài khoản người dùng thành công' };
    },

    deleteUser: async (userId, currentUserId) => {
        if (parseInt(userId) === currentUserId) {
            throw new Error('CANNOT_DELETE_SELF');
        }

        const affectedRows = await EmployeesModel.remove(userId);
        if (affectedRows === 0) {
            throw new Error('USER_NOT_FOUND');
        }

        return { success: true, message: 'Xóa tài khoản người dùng thành công' };
    }
};

module.exports = UsersService;
