import { AppError } from "../utils/errors.js";
export function uploadSingle(req, res) {
  if (!req.file) throw new AppError(400, 'Chưa có file nào được tải lên.');
  res.status(201).json({ success: true, data: {
    url: '/uploads/' + req.file.filename,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  } });
}
