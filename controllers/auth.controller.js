const db = require("../config/db");
const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET || "hotel_management_secret_key_2026";

// Ktra đầu số điện thoại
function getCountryFromPhone(phone) {
  if (!phone) { return "Việt Nam"; }
  if (phone.startsWith("+1")) { return "Hoa Kỳ"; }
  if (phone.startsWith("+81")) { return "Nhật Bản"; }
  if (phone.startsWith("+82")) { return "Hàn Quốc"; }
  return "Việt Nam";
}

// Hàm tạo cấu trúc của Payload 
function createTokenPayload(user, type) { // type là NV hoặc KH
  const payload = {
    id: user.employee_id || user.customer_id || user.id,
    full_name: user.full_name,
    role: user.role || "customer",
    type: type,
  };

  // Kiểm tra loại user để thêm thông tin phù hợp với vai trò
  if (type === "employee") { // Nếu là NV thêm username vào payload
    payload.username = user.username;
  } else { // Nếu là KH thêm email, phone, country vào payload
    payload.email = user.email;
    payload.phone = user.phone;
    payload.country = user.country;
  }
  return payload;
}

// Xử lý đăng nhập
async function login(request, response) {
  // 1. Lấy dữ liệu và kiểm tra thông tin đầu vào
  const { username, password } = request.body; // user hoặc pass nhập(từ Client) để gửi tới Server

  if (!username || !password) { // Kiểm tra xem user hoặc pass có bị thiếu không
    return response.status(400).json({
      success: false, // False vì thiếu user hoặc pass
      message: "Vui lòng nhập tài khoản và mật khẩu" // Thông báo lỗi
    });
  }

  try { // Try-catch là để xử lý lỗi
    // 1. Kiểm tra trong bảng nhân viên trước
    const [employees] = await db.query( // query() là hàm truy vấn db
      "SELECT * FROM employees WHERE username = ?", // câu truy vấn
      [username],
    );

    if (employees.length > 0) { // Kiểm tra có tk nhân viên không
      const employee = employees[0]; // Lấy thông tin nhân viên từ db
      if (employee.status === "locked") { // Kiểm tra có tk bị khóa(locked) không
        return response.status(403).json({
          success: false, // Trả về false ko đủ đk vì tk bị khóa
          message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.",
        });
      }

      // So sánh mật khẩu trực tiếp (theo dữ liệu mẫu thô ban đầu của nhóm)
      if (password === employee.password) { // Nếu mật khẩu đúng
        const payload = createTokenPayload(employee, "employee"); // Tạo payload
        const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "24h" }); // Tạo token
        return response.json({
          success: true, // Trả về true vì điều kiện trên được thỏa mãn
          message: "Đăng nhập thành công (Nhân viên)", // Trả về thông báo thành công
          token, // Trả về token
          user: payload, // Trả về payload
        });
      }
    }

    // 2. Nếu không phải NV thì ktra bên KH (username = email/phone)
    const [customers] = await db.query(
      "SELECT * FROM customers WHERE email = ? OR phone = ?",
      [username, username],
    );

    if (customers.length > 0) { // Kiểm tra có tk KH không
      const customer = customers[0]; // Lấy thông tin KH từ db
      if (password === customer.password) { // Nếu mật khẩu đúng
        const payload = createTokenPayload(customer, "customer"); // Tạo payload
        const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "24h" }); // Tạo token
        return response.json({
          success: true, // Trả về true vì điều kiện trên được thỏa mãn
          message: "Đăng nhập thành công (Khách hàng)", // Trả về thông báo thành công
          token,
          user: payload,
        });
      }
    }

    return response.status(401).json({
      success: false,
      message: "Tài khoản hoặc mật khẩu không chính xác",
    });

  } catch (err) {
    return response.status(500).json({
      success: false,
      message: "Lỗi máy chủ: " + err.message
    });
  }
}

//  Chức năng đăng ký tài khoản khách hàng 
async function register(request, response) {
  // 1. Lấy dữ liệu và kiểm tra thông tin đầu vào
  const { full_name, email, phone, password, cccd } = request.body; // Trường cccd là trường tùy chọn
  if (!full_name || !email || !phone || !password) {  // Ktra điền các trường có bị thiếu không
    return response.status(400).json({ // 400 vì thiếu hoặc sai thông tin bắt buộc
      success: false,
      message: "Vui lòng điền đầy đủ thông tin bắt buộc",
    });
  }

  // 2. ktra xem email/sdt có tồn tại trong db chưa (khối sử lý lỗi)
  try {
    // Ktra email/sdt đã tồn tại trong db chưa
    const [exist] = await db.query( // query() là hàm truy vấn db
      "SELECT 1 FROM customers WHERE email = ? OR phone = ?", // câu truy vấn
      [email, phone], // tham số
    );

    if (exist.length > 0) { // email/sdt đã tồn tại trong db
      return response.status(400).json({
        success: false,
        message: "Email hoặc số điện thoại đã được đăng ký",
      });
    }

    // ktra quốc gia từ sdt
    const country = getCountryFromPhone(phone);

    // Thêm tk khách hàng vào db
    const [resDb] = await db.query(
      `INSERT INTO customers (full_name, email, phone, country, cccd, password, role) 
             VALUES (?, ?, ?, ?, ?, ?, 'customer')`,
      [full_name, email, phone, country, cccd || null, password],
    );

    // Tạo userData từ thông tin khách hàng
    const userData = {
      id: resDb.insertId, // Lấy id vừa tạo
      full_name,
      email,
      phone,
      country,
    };

    // Tạo payload và token
    const payload = createTokenPayload(userData, "customer");
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "24h" });

    return response.status(200).json({ // Trả về kết quả đăng ký thành công
      success: true,
      message: "Đăng ký tài khoản thành công",
      token,
      user: payload,
    });
  } catch (err) { // Bắt lỗi
    return response.status(500).json({
      success: false,
      message: "Lỗi máy chủ: " + err.message
    });
  }
}

module.exports = {
  login,
  register,
};

/*
Client
    │ Gửi POST /register
    ▼
Express Router
    │
    ▼
register(request, response)
    │
    ├── request.body >> Lấy full_name, email, phone, password
    │      
    ├── Kiểm tra dữ liệu
    │
    ├── Truy vấn MySQL (await db.query)
    │
    └── response.status(...).json(...) >> Trả kết quả về Client      
*/