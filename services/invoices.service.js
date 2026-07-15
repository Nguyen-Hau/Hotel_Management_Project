const InvoicesModel = require('../models/invoices.model');
const auditService = require('./audit.service');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const InvoicesService = {
    getAll: async (user) => {
        return await InvoicesModel.getAll(user.role, user.id);
    },

    getById: async (id) => {
        const invoiceData = await InvoicesModel.findById(id);
        if (!invoiceData) {
            throw new Error('INVOICE_NOT_FOUND');
        }

        invoiceData.services = await InvoicesModel.getServicesByBooking(invoiceData.booking_id);

        if (invoiceData.booking_group_id) {
            const groupRows = await InvoicesModel.getGroupInvoices(invoiceData.booking_group_id);
            for (let gInv of groupRows) {
                gInv.services = await InvoicesModel.getServicesByBooking(gInv.booking_id);
            }
            invoiceData.group_invoices = groupRows;
        }

        return invoiceData;
    },

    getByBooking: async (bookingId) => {
        const invoice = await InvoicesModel.getByBooking(bookingId);
        if (!invoice) {
            throw new Error('INVOICE_NOT_FOUND');
        }
        return invoice;
    },

    pay: async (request, id, body) => {
        const { payment_method, pay_group } = body;
        const invoice = await InvoicesModel.findById(id);
        if (!invoice) throw new Error('INVOICE_NOT_FOUND');
        if (invoice.status === 'paid') throw new Error('INVOICE_ALREADY_PAID');

        const method = payment_method || 'cash';

        if (pay_group && invoice.booking_group_id) {
            const toPayInvs = await InvoicesModel.getUnpaidGroupInvoices(invoice.booking_group_id);
            await InvoicesModel.updateGroupStatus(invoice.booking_group_id, method);

            for (let inv of toPayInvs) {
                await auditService.logAction(request, 'PAY_INVOICE', 'invoices', inv.invoice_id, 
                    { status: 'unpaid' }, 
                    { status: 'paid', payment_method: method }
                );
            }
            return { success: true, message: 'Thanh toán gộp các hóa đơn thành công' };
        } else {
            await InvoicesModel.updateStatus(id, method);

            await auditService.logAction(request, 'PAY_INVOICE', 'invoices', id, 
                { status: 'unpaid' }, 
                { status: 'paid', payment_method: method }
            );
            return { success: true, message: 'Thanh toán hóa đơn thành công' };
        }
    },

    sendEmail: async (id) => {
        const inv = await InvoicesModel.getEmailDetails(id);
        if (!inv) throw new Error('INVOICE_NOT_FOUND');
        if (!inv.email) throw new Error('EMAIL_MISSING');

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: inv.email,
                subject: `[Hotel Management] Hóa đơn thanh toán #${inv.invoice_id}`,
                html: `<div><h3>Xin chào ${inv.full_name},</h3><p>Đây là hóa đơn của bạn...</p></div>`
            });
            return { success: true, message: 'Đã gửi email hóa đơn thành công' };
        }
        return { success: true, message: 'Email định dạng demo (Chưa cấu hình tài khoản gửi)' };
    }
};

module.exports = InvoicesService;
