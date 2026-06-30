import { describe, expect, it } from "vitest";
import { translateText } from "@/lib/i18n";

describe("translations", () => {
  it("keeps SPI and import copy fully Korean", () => {
    expect(translateText("Speed, improvement, consistency, and event difficulty compressed into one proprietary read.", "ko"))
      .toBe("속도, 향상도, 일관성, 종목 난이도를 하나의 자체 지표로 압축합니다.");
    expect(translateText("Upload CSV columns: Date, Event, Time, optional Course, Meet, Type", "ko"))
      .toBe("스프레드시트 파일 열: 날짜, 종목, 기록, 선택 항목인 코스, 대회, 유형");
    expect(translateText("45% speed", "ko")).toBe("속도 45%");
    expect(translateText("Speed score", "ko")).toBe("속도 점수");
  });

  it("keeps SPI and import copy fully Vietnamese", () => {
    expect(translateText("Speed, improvement, consistency, and event difficulty compressed into one proprietary read.", "vi"))
      .toBe("Tốc độ, mức cải thiện, độ ổn định và độ khó nội dung được gói thành một chỉ số riêng.");
    expect(translateText("Upload CSV columns: Date, Event, Time, optional Course, Meet, Type", "vi"))
      .toBe("Các cột tệp bảng tính: ngày, nội dung, thời gian, bể tùy chọn, giải đấu, loại");
    expect(translateText("45% speed", "vi")).toBe("45% tốc độ");
    expect(translateText("Elite", "vi")).toBe("Đẳng cấp cao");
  });

  it("translates grounded prediction and typewriter phrases", () => {
    expect(translateText("Predictions stay grounded.", "ko")).toBe("예측은 현실적인 범위 안에서 유지됩니다.");
    expect(translateText("Predictions stay grounded.", "vi")).toBe("Dự đoán luôn có cơ sở thực tế.");
    expect(translateText("your next breakthrough.", "ko")).toBe("다음 돌파구.");
    expect(translateText("your next breakthrough.", "vi")).toBe("bước đột phá tiếp theo.");
  });
});
