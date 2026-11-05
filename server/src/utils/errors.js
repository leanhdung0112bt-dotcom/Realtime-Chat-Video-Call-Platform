export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof AppError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'JSON không hợp lệ.' });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ success: false, message: 'Nội dung yêu cầu vượt quá giới hạn.' });
    return;
  }
  if (error?.code === 11000) {
    res.status(409).json({ success: false, message: 'Dữ liệu đã tồn tại. Vui lòng tải lại và thử lại.' });
    return;
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError' || error?.name === 'MulterError') {
    res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ hoặc file vượt quá giới hạn 20 MB.' });
    return;
  }
  console.error('[request:error]', error?.name || 'Error');
  res.status(500).json({ success: false, message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' });
}
