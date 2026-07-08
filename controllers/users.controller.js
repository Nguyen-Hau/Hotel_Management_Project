const db = require("../config/db");
const bcrypt = require("bcryptjs");

function errRes(res, msg, err) {
  console.error(msg, err);
  return res.status(500).json({ message: msg });
}

async function getAllUsers(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT employee_id, full_name, username, role, status, created_at FROM employees ORDER BY employee_id DESC",
    );
    return res.json(rows);
  } catch (err) {
    return errRes(res, "Lỗi khi lấy danh sách tài khoản", err);
  }
}

async function createUser(req, res) {
  try {
    const { full_name, username, password, role, status } = req.body;
    if (!full_name || !username || !password || !role) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }

    const [exist] = await db.query(
      "SELECT 1 FROM employees WHERE username = ?",
      [username],
    );
    if (exist.length > 0) {
      return res
        .status(400)
        .json({ message: "Tên đăng nhập hệ thống đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [r] = await db.query(
      "INSERT INTO employees (full_name, username, password, role, status) VALUES (?, ?, ?, ?, ?)",
      [full_name, username, hashedPassword, role, status || "active"],
    );
    return res.json({
      success: true,
      message: "Tạo tài khoản người dùng thành công",
      id: r.insertId,
    });
  } catch (err) {
    return errRes(res, "Lỗi khi tạo người dùng", err);
  }
}

async function updateUser(req, res) {
  try {
    const { full_name, username, role, password, status } = req.body;
    const userId = req.params.id;

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
      return res
        .status(404)
        .json({ message: "Không tìm thấy tài khoản người dùng" });
    }
    return res.json({
      success: true,
      message: "Cập nhật tài khoản người dùng thành công",
    });
  } catch (err) {
    return errRes(res, "Lỗi khi cập nhật thông tin người dùng", err);
  }
}

async function deleteUser(req, res) {
  try {
    const userId = req.params.id;
    if (parseInt(userId) === req.user.id) {
      return res
        .status(400)
        .json({
          message: "Không được phép tự xóa tài khoản chính mình đang đăng nhập",
        });
    }

    const [r] = await db.query("DELETE FROM employees WHERE employee_id = ?", [
      userId,
    ]);
    if (r.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy người dùng cần xóa" });
    }
    return res.json({
      success: true,
      message: "Xóa tài khoản người dùng thành công",
    });
  } catch (err) {
    return errRes(res, "Lỗi khi xóa người dùng khỏi hệ thống", err);
  }
}

async function getUserById(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT employee_id, full_name, username, role, status, created_at FROM employees WHERE employee_id = ?",
      [req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    return res.json(rows[0]);
  } catch (err) {
    return errRes(res, "Lỗi khi lấy thông tin chi tiết người dùng", err);
  }
}

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserById,
};
