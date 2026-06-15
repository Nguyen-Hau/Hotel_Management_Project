const db = require("../../backend/config/db");

// =====================
// ADD SERVICE TO BOOKING
// =====================
exports.addService = (req, res) => {
  const { booking_id, service_id, quantity } = req.body;

  db.query(
    `INSERT INTO booking_services (booking_id, service_id, quantity)
     VALUES (?, ?, ?)`,
    [booking_id, service_id, quantity || 1],
    (err) => {
      if (err) 
        return res.status(500).json(err); res.json({ 
        message: "Thêm dịch vụ thành công" 
      });
    }
  );
};

// =====================
// GET SERVICES BY BOOKING
// =====================
exports.getByBooking = (req, res) => {
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

  db.query(sql, [booking_id], (err, data) => {
    if (err) 
      return res.status(500).json(err); res.json(data);
  });
};

// =====================
// DELETE SERVICE
// =====================
exports.remove = (req, res) => {
  db.query(
    "DELETE FROM booking_services WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) 
        return res.status(500).json(err); res.json({ message: "Đã xóa dịch vụ" 
      });
    }
  );
};
