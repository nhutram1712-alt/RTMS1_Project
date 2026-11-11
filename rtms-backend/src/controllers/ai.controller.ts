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

export const scanMeter = async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ảnh công tơ.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.startsWith('AIzaSyDummy')) {
      return res.status(400).json({
        success: false,
        message: 'Chưa cấu hình GEMINI_API_KEY hợp lệ trong file .env của backend.'
      });
    }

    // LỚP 1: SIÊU PROMPT CHỦ ĐỘNG BỎ QUA VỎ NGOÀI
    const promptText = `
Bạn là máy quét OCR công tơ điện. 
Nhiệm vụ: CHỈ ĐỌC dãy số hiển thị trên MÀN HÌNH LCD MÀU XÁM ở chính giữa (Phông chữ 7-segment màu đen kích thước LỚN NHẤT, ví dụ: 2169) HOẶC BÁNH RĂNG CÔNG TƠ CƠ (dãy số nền đen trước ô màu đỏ, ví dụ: 99985).

BỘ LỌC CẮT BỎ TUYỆT ĐỐI:
- BỎ QUA TOÀN BỘ chữ và số in trên vỏ nhựa màu trắng xung quanh: "TCVN: 7589-22:2007", "IEC: 62053-23:2003", "12.000 xung/kW.h".
- BỎ QUA các số OBIS nhỏ ở góc trên màn hình LCD: "4.1.8.0", "U1U2U3", "L2".

Chỉ trả về DUY NHẤT con số hiển thị to nhất trên màn hình LCD / ô bánh răng (ví dụ: 2169 hoặc 99985). Không kèm thêm bất kỳ chữ cái hay ký tự nào.
    `;

    let rawText = '';

    // Ưu tiên gọi REST endpoint Gemini Vision API v1beta
    try {
      const apiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptText },
                { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } }
              ]
            }],
            generationConfig: {
              temperature: 0.0,
              topP: 1.0
            }
          })
        }
      );

      const data: any = await apiResponse.json();
      rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (fetchErr) {
      // Fallback qua @google/genai SDK
      const ai = new GoogleGenAI({ apiKey });
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
      rawText = response.text || '';
    }

    // LỚP 2: BỘ LỌC CỨNG BẰNG CODE (HARDCODE FILTER BACKEND)
    // Lấy tất cả các cụm số tìm thấy trong phản hồi của AI
    const allNumbers = rawText.match(/\d+/g) || [];

    // Danh sách các số tiêu chuẩn/thông số kỹ thuật BẮT BUỘC BỎ QUA
    const blacklist = [
      '62053', '7589', '62052', '2003', '2007', '22', '23', '12000', '10000',
      '220', '50', '450', '900', '225', '140', '26', '41'
    ];

    // Lọc bỏ những số nằm trong danh sách đen
    const validNumbers = allNumbers.filter((numStr: string) => !blacklist.includes(numStr));

    if (validNumbers.length > 0) {
      // Lấy con số hợp lệ đầu tiên (ví dụ: 2169, 99985)
      const meterValue = parseInt(validNumbers[0], 10);
      return res.json({
        success: true,
        message: 'Bóc tách chỉ số đồng hồ điện thành công!',
        meterValue,
        kwh: meterValue,
        data: { meterValue, kwh: meterValue }
      });
    }

    return res.status(422).json({
      success: false,
      message: 'Không thể nhận diện được chỉ số điện trên màn hình LCD. Vui lòng chụp cận cảnh màn hình!'
    });

  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
