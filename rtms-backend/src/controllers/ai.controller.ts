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

    const promptText = `Hãy quan sát ảnh Căn cước công dân Việt Nam và trích xuất đúng 12 chữ số thuộc mục 'Số / No.'. Chỉ trả về DUY NHẤT dãy 12 chữ số này. Nếu ảnh mờ không thấy rõ 12 số, trả về 'UNREADABLE'.`;

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
      ],
      config: {
        temperature: 0.0,
        topP: 1.0
      }
    });

    const rawText = (response.text || '').trim();

    if (rawText.includes('UNREADABLE')) {
      res.status(422).json({
        success: false,
        message: 'Ảnh mờ hoặc không thấy rõ dãy 12 số CCCD. Vui lòng chụp lại rõ nét hơn!'
      });
      return;
    }

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

    const promptText = `Bạn là hệ thống OCR công tơ điện chuyên dụng. Hãy trích xuất chỉ số tiêu thụ điện (kWh) theo quy tắc:
1. VỚI CÔNG TƠ CƠ (EMIC bánh răng): CHỈ ĐỌC dãy số nằm trên NỀN ĐEN (phần số nguyên). BỎ QUA HOÀN TOÀN chữ số nằm trên NỀN ĐỎ ở cuối (phần thập phân 1/10).
2. VỚI CÔNG TƠ ĐIỆN TỬ (LCD): CHỈ ĐỌC dãy số đi kèm đơn vị "kWh". Nếu màn hình hiển thị Volts (V), Amperes (A) hoặc màn hình LCD bị tối/tắt, trả về chữ "INVALID_SCREEN".
3. BỎ QUA HOÀN TOÀN SỐ NHIỄU: Mã kiểu (DDS26, CV140, ME-41, PDM...), Số Series (No.19769888, 07772480, 256616...), Tem kiểm định (16202, 07183, N420, N148...), thông số 220V, 5(80)A, 50Hz.
4. NẾU ẢNH MỜ / LÓA SÁNG KHÔNG THỂ KHẲNG ĐỊNH CHÍNH XÁC: Trả về chữ 'UNREADABLE'. TUYỆT ĐỐI KHÔNG TỰ ĐOÁN HOẶC BỊA SỐ.
5. Đầu ra: Chỉ trả về DUY NHẤT chuỗi số nguyên (Ví dụ: 853, 99985, 220).`;

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
      ],
      config: {
        temperature: 0.0,
        topP: 1.0
      }
    });

    const rawText = (response.text || '').trim();

    if (rawText.includes('INVALID_SCREEN')) {
      res.status(422).json({
        success: false,
        message: 'Màn hình công tơ bị tắt hoặc không hiển thị chỉ số kWh.'
      });
      return;
    }

    if (rawText.includes('UNREADABLE')) {
      res.status(422).json({
        success: false,
        message: 'Ảnh bị mờ hoặc chói sáng. Vui lòng chụp rõ nét hơn!'
      });
      return;
    }

    const cleanNumber = rawText.replace(/\D/g, ''); // Lọc bỏ toàn bộ ký tự không phải số
    const meterVal = cleanNumber ? parseInt(cleanNumber, 10) : NaN;

    if (isNaN(meterVal)) {
      res.status(422).json({
        success: false,
        message: 'Ảnh bị mờ hoặc chói sáng. Vui lòng chụp rõ nét hơn!'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Bóc tách chỉ số đồng hồ điện thành công!',
      meterValue: meterVal,
      kwh: meterVal,
      data: { meterValue: meterVal, kwh: meterVal }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi bóc tách công tơ điện: ' + error.message });
  }
};
