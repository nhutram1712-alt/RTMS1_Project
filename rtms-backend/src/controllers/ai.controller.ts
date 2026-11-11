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

    const promptText = `Bạn là hệ thống AI quét OCR chuyên dụng cho TẤT CẢ CÁC LOẠI ĐỒNG HỒ ĐIỆN (1 pha, 3 pha trực tiếp/gián tiếp) tại Việt Nam. Nhiệm vụ của bạn là trích xuất đúng chỉ số tiêu thụ điện thực tế (kWh) theo các quy tắc khắt khe sau:

BƯỚC 1: XÁC ĐỊNH ĐÚNG VÙNG ĐỌC SỐ
A. Đối với Đồng hồ cơ (1 pha 2 dây, 3 pha):
   - ĐỒNG HỒ 6 SỐ: Chỉ đọc 5 chữ số đầu tiên nằm trong khung nền MÀU ĐEN (đây là phần số nguyên kWh). TUYỆT ĐỐI BỎ QUA 1 chữ số cuối cùng nằm trong khung nền MÀU ĐỎ (đây là giá trị 1/10 kWh). Ví dụ: hiển thị 999853 (3 nền đỏ) thì chỉ đọc '99985'.
B. Đối với Công tơ điện tử:
   - Chỉ tập trung vào dãy số LED có KÍCH THƯỚC LỚN NHẤT nằm ở vị trí trung tâm màn hình, ngay phía trước đơn vị 'kWh'.

BƯỚC 2: BỘ LỌC ĐEN - BỎ QUA TOÀN BỘ CÁC THÔNG SỐ KỸ THUẬT SAU:
   - Các mã tiêu chuẩn in trên vỏ: 'TCVN', 'IEC' (VD: 62053, 62053-23:2003, 62052).
   - Điện áp & Tần số: '220V', '50Hz'.
   - Dòng điện định mức: '5(20)A', '10(40)A', '20(80)A', '30(60)A', '50(100)A'.
   - Hằng số xung / Số vòng: '225 vòng/kWh', '450 vòng/kWh', '900 vòng/kWh', '12.000 xung/kW.h'.
   - Các ký hiệu OBIS nhỏ: '4.1.8.0', '1.8.0', 'L1', 'L2', 'L3'.

BƯỚC 3: ĐỊNH DẠNG KẾT QUẢ ĐẦU RA:
   - Nếu nhận diện thành công: Chỉ trả về DUY NHẤT dãy số nguyên (Ví dụ: 99985, 31072, 2169).
   - Nếu ảnh mờ, lóa hoặc màn hình đang hiển thị sai thông số mà không thể khẳng định chắc chắn: Trả về chữ 'UNREADABLE'. TUYỆT ĐỐI KHÔNG TỰ ĐOÁN SỐ.`;

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

    // Danh sách các con số kỹ thuật và tiêu chuẩn thường gặp để chặn
    const blacklist = [
      '62053', '62052', '7589', '2003', '2007', '220', '50', '225', '450', '900',
      '520', '1040', '2080', '3060', '50100', '140', '26', '41'
    ];

    if (blacklist.includes(cleanNumber)) {
      res.status(422).json({
        success: false,
        message: 'Hệ thống AI nhận diện nhầm vào thông số kỹ thuật (Tiêu chuẩn / Vòng / Điện áp) thay vì chỉ số điện năng. Vui lòng chụp rõ và gần hơn vào khung hiển thị số!'
      });
      return;
    }

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
