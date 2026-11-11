import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export const scanCccd = async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageBase64, side } = req.body;

    if (!imageBase64) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp hình ảnh CCCD dạng Base64.' });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.startsWith('AIzaSyDummy')) {
      res.status(400).json({
        success: false,
        message: 'Chưa cấu hình GEMINI_API_KEY hợp lệ trong file .env của backend.'
      });
      return;
    }

    // Call official Gemini Vision AI via @google/genai SDK
    const ai = new GoogleGenAI({ apiKey });

    const promptText = `Đây là ảnh CCCD Việt Nam (có thể bị xoay). Hãy bóc tách và trả về DUY NHẤT dãy 12 chữ số thuộc mục Số/No. Không kèm bất kỳ ký tự nào khác.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: 'image/jpeg'
              }
            },
            {
              text: promptText
            }
          ]
        }
      ]
    });

    const rawText = response.text || '';
    const match = rawText.match(/\d{12}/);
    const detectedCccd = match ? match[0] : '';

    if (!detectedCccd) {
      res.status(422).json({
        success: false,
        message: 'Ảnh mờ hoặc không nhận diện được số CCCD 12 chữ số. Vui lòng kiểm tra lại.'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Bóc tách mã số CCCD thành công!',
      cccd: detectedCccd,
      data: { cccd: detectedCccd, side: side || 'front' }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi bóc tách CCCD: ' + error.message });
  }
};

export const scanMeter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp hình ảnh công tơ điện dạng Base64.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.startsWith('AIzaSyDummy')) {
      res.status(400).json({
        success: false,
        message: 'Chưa cấu hình GEMINI_API_KEY hợp lệ trong file .env của backend.'
      });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const promptText = `Bạn là hệ thống OCR chuyên dụng đọc công tơ điện Việt Nam (EMIC 1 pha / 3 pha / điện tử).
BƯỚC 1: Khoanh vùng DUY NHẤT ô chữ nhật hiển thị số nằm ở phía trên cùng của mặt đồng hồ (khung chứa các bánh răng số quay).
BƯỚC 2: BỎ QUA HOÀN TOÀN tất cả các con số khác trên mặt đồng hồ:
- Bỏ qua mã sản phẩm (VD: PDM 023-2007)
- Bỏ qua tem kiểm định (VD: 16202, N148)
- Bỏ qua Số SX (VD: 10 256616)
- Bỏ qua thông số điện áp/dòng điện (220V, 10(40)A, 450 vòng/kWh, 50Hz, 2010).

BƯỚC 3: Đọc dãy số trong ô bánh răng theo quy tắc:
- Các chữ số nằm trong khung NỀN ĐEN: Là phần số nguyên kWh.
- Chữ số cuối cùng nằm trong khung NỀN ĐỎ (nếu có): Là phần thập phân (1/10 kWh).
- Chỉ lấy phần SỐ NGUYÊN (nền đen). Nếu các bánh răng đang quay lỡ cỡ giữa 2 số, lấy số nguyên rõ nhất.

BƯỚC 4: Trả về kết quả:
Chỉ trả về DUY NHẤT chuỗi các chữ số nguyên đọc được (Ví dụ: 99985 hoặc 985 hoặc 853). Tuyệt đối không thêm bất kỳ chữ cái, dấu chấm, dấu phẩy hay ký tự nào khác.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: 'image/jpeg'
              }
            },
            {
              text: promptText
            }
          ]
        }
      ]
    });

    const rawText = response.text || '';
    const cleanNumber = rawText.replace(/\D/g, ''); // Lọc bỏ toàn bộ ký tự không phải số
    const kwh = cleanNumber ? parseInt(cleanNumber, 10) : 0;

    if (!cleanNumber) {
      res.status(422).json({
        success: false,
        message: 'Không nhận diện được dãy số chỉ số điện nguyên trên mặt công tơ.'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Bóc tách chỉ số đồng hồ điện thành công!',
      kwh,
      meterValue: cleanNumber,
      data: { kwh, meterValue: cleanNumber }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi bóc tách công tơ điện: ' + error.message });
  }
};
