const db = require("../config/db");
const bcrypt = require("bcryptjs");

function errRes(response, msg, err) {
  console.error(msg, err);
  return response.status(500).json({ message: msg });
}

// 2. Lấy tất cả các tài khoản
async function getAllUsers(request, response) {
  try {
    const [rows] = await db.query(
      "SELECT employee_id, full_name, username, role, status, created_at FROM employees ORDER BY employee_id DESC",
    );
    return response.json(rows);
  } catch (err) {
    return errRes(response, "Lỗi khi lấy danh sách tài khoản", err);
  }
}

// 3. Thêm tài khoản mới
async function createUser(request, response) {
  try {
    const { full_name, username, password, role, status } = request.body;
    if (!full_name || !username || !password || !role) {
      return response.status(400).json({
        message: "Vui lòng nhập đầy đủ thông tin"
      });
    }

    const [exist] = await db.query(
      "SELECT 1 FROM employees WHERE username = ?",
      [username],
    );
    if (exist.length > 0) {
      return response.status(400).json({
        message: "Tên đăng nhập hệ thống đã tồn tại"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [r] = await db.query(
      "INSERT INTO employees (full_name, username, password, role, status) VALUES (?, ?, ?, ?, ?)",
      [full_name, username, hashedPassword, role, status || "active"],
    );
    return response.json({
      success: true,
      message: "Tạo tài khoản người dùng thành công",
      id: r.insertId,
    });
  } catch (err) {
    return errRes(response, "Lỗi khi tạo người dùng", err);
  }
}

// 4. Cập nhật thông tin tài khoản
async function updateUser(request, response) {
  try {
    const { full_name, username, role, password, status } = request.body;
    const userId = request.params.id;

    let sql =
      "UPDATE employees SET full_name = ?, username = ?, role = ?, status = ?";
    let params = [full_name, username, role, status || "active"];

    if (password && password.trim() !== "") {
      sql += ", password = ?";
      const hashedPassword = await bcrypt.hash(password, 10);
      params.push(hashedPassword);
    }

    sql += " WHERE employee_id = ?";
    params.push(userId);

    const [r] = await db.query(sql, params);
    if (r.affectedRows === 0) {
      return response.status(404).json({
        message: "Không tìm thấy tài khoản người dùng"
      });
    }
    return response.json({
      success: true,
      message: "Cập nhật tài khoản người dùng thành công",
    });
  } catch (err) {
    return errRes(response, "Lỗi khi cập nhật thông tin người dùng", err);
  }
}

// 5. Xóa tài khoản người dùng
async function deleteUser(request, response) {
  try {
    const userId = request.params.id;
    if (parseInt(userId) === request.user.id) {
      return response.status(400).json({
        message: "Không được phép tự xóa tài khoản chính mình đang đăng nhập",
      });
    }

    const [r] = await db.query("DELETE FROM employees WHERE employee_id = ?", [
      userId,
    ]);
    if (r.affectedRows === 0) {
      return response.status(404).json({
        message: "Không tìm thấy người dùng cần xóa"
      });
    }
    return response.json({
      success: true,
      message: "Xóa tài khoản người dùng thành công",
    });
  } catch (err) {
    return errRes(response, "Lỗi khi xóa người dùng khỏi hệ thống", err);
  }
}

// 6. Lấy thông tin chi tiết của tài khoản
async function getUserById(request, response) {
  try {
    const [rows] = await db.query(
      "SELECT employee_id, full_name, username, role, status, created_at FROM employees WHERE employee_id = ?",
      [request.params.id],
    );
    if (rows.length === 0) {
      return response.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    return response.json(rows[0]);
  } catch (err) {
    return errRes(response, "Lỗi khi lấy thông tin chi tiết người dùng", err);
  }
}

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserById,
};
