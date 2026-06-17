const db = require("../config/db");

// Thêm dịch vụ vào đơn đặt phòng
async function addService(req, res) {
  const { booking_id, service_id, quantity } = req.body;

  try {
    const sql = "INSERT INTO booking_services (booking_id, service_id, quantity) VALUES (?, ?, ?)";
    const qty = quantity || 1;
    
    await db.query(sql, [booking_id, service_id, qty]);
    return res.json({ message: "Thêm dịch vụ thành công" });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi hệ thống khi thêm dịch vụ", error: err.message });
  }
}

// Lấy danh sách dịch vụ của một phòng
async function getByBooking(req, res) {
  const booking_id = req.params.booking_id;

  const sql = `
    SELECT 
      s.service_name,
      s.price,
      bs.quantity,
      (s.price * bs.quantity) AS total
    FROM booking_services bs
    JOIN services s ON bs.service_id = s.service_id
    WHERE bs.booking_id = ?
  `;

  try {
    const [data] = await db.query(sql, [booking_id]);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: "Lỗi hệ thống khi tải dịch vụ phòng", error: err.message });
  }
}

module.exports = {
  addService,
  getByBooking
};