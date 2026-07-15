const EmployeesModel = require('../models/employees.model');
const bcrypt = require('bcryptjs');

const EmployeesService = {
    getAll: async () => {
        return await EmployeesModel.getAll();
    },

    getById: async (id) => {
        const emp = await EmployeesModel.findById(id);
        if (!emp) throw new Error('EMPLOYEE_NOT_FOUND');
        return emp;
    },

    create: async (body) => {
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
            status
        });

        return { success: true, message: 'Thêm nhân viên thành công', id: insertId };
    },

    update: async (id, body) => {
        const { full_name, username, role, password, status } = body;
        
        let hasPassword = false;
        let pass = null;
        if (password && password.trim() !== '') {
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
            throw new Error('EMPLOYEE_NOT_FOUND');
        }

        return { success: true, message: 'Cập nhật nhân viên thành công' };
    },

    remove: async (id) => {
        const affectedRows = await EmployeesModel.remove(id);
        if (affectedRows === 0) {
            throw new Error('EMPLOYEE_NOT_FOUND');
        }
        return { success: true, message: 'Xóa tài khoản nhân viên thành công' };
    }
};

module.exports = EmployeesService;
