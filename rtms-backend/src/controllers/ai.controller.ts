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

    const promptText = `Đây là ảnh chụp mặt hiển thị của công tơ điện / đồng hồ điện. Hãy quan sát kỹ các ô số thể hiện chỉ số tiêu thụ kWh (dãy số chính màu đen nằm trước ô màu đỏ lẻ 1/10 hoặc màn hình điện tử). Hãy đọc và chỉ trả về DUY NHẤT dãy chữ số nguyên này (Ví dụ: 99985, 220, 1540). Không kèm chữ kWh hay bất kỳ ký tự nào khác.`;

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
    const match = rawText.match(/\d+/);
    const kwh = match ? parseInt(match[0], 10) : 0;

    res.status(200).json({
      success: true,
      message: 'Bóc tách chỉ số đồng hồ điện thành công!',
      kwh,
      data: { kwh }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi bóc tách công tơ điện: ' + error.message });
  }
};
