import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { translations, translateText } from "@/lib/i18n";

function appTranslationKeys() {
  const keys = new Set<string>();

  for (const directory of ["app", "src"]) {
    const root = join(process.cwd(), directory);
    const files = readdirSync(root, { recursive: true })
      .filter((file): file is string => typeof file === "string" && /\.(ts|tsx)$/.test(file));

    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      for (const match of source.matchAll(/\bt\(\s*"([^"]+)"\s*\)/g)) {
        keys.add(JSON.parse(`"${match[1]}"`) as string);
      }
    }
  }

  return [...keys].sort();
}

const allowedKoreanLatinTokens = new Set(["LCM", "SCM", "SCY", "ISO", "M", "SS"]);
const allowedUnchangedVietnameseKeys = new Set([
  "Brier",
  "Instagram",
  "LCM",
  "SCM",
  "SCY",
  "SwimSight"
]);

function visibleKoreanText(value: string) {
  return value.replace(/@[A-Za-z0-9_.-]+/g, "");
}

describe("translations", () => {
  it("has exact Korean and Vietnamese entries for every literal app translation key", () => {
    const keys = appTranslationKeys();
    const missingKorean = keys.filter((key) => !translations.ko[key]);
    const missingVietnamese = keys.filter((key) => !translations.vi[key]);

    expect(missingKorean).toEqual([]);
    expect(missingVietnamese).toEqual([]);
  });

  it("does not leak English words into Korean UI strings", () => {
    const leaked = appTranslationKeys()
      .map((key) => [key, translateText(key, "ko")] as const)
      .map(([key, translated]) => ({
        key,
        translated,
        tokens: visibleKoreanText(translated).match(/[A-Za-z]+/g)?.filter((token) => !allowedKoreanLatinTokens.has(token)) ?? []
      }))
      .filter((entry) => entry.tokens.length > 0);

    expect(leaked).toEqual([]);
  });

  it("does not leak English words anywhere in the Korean dictionary", () => {
    const leaked = Object.entries(translations.ko)
      .map(([key, translated]) => ({
        key,
        translated,
        tokens: visibleKoreanText(translated).match(/[A-Za-z]+/g)?.filter((token) => !allowedKoreanLatinTokens.has(token)) ?? []
      }))
      .filter((entry) => entry.tokens.length > 0);

    expect(leaked).toEqual([]);
  });

  it("does not leave English app copy unchanged in Vietnamese", () => {
    const unchanged = appTranslationKeys().filter((key) => {
      if (allowedUnchangedVietnameseKeys.has(key)) return false;
      if (!/[A-Za-z]/.test(key)) return false;
      return translations.vi[key] === key;
    });

    expect(unchanged).toEqual([]);
  });

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

  it("fully localizes public validation and coach operational states", () => {
    expect(translateText("Validation", "ko")).toBe("검증");
    expect(translateText("Eligible official races", "ko")).toBe("적격 공식 경기");
    expect(translateText("PERMISSION PENDING", "ko")).toBe("권한 승인 대기");
    expect(translateText("Post-meet reviews", "ko")).toBe("대회 후 리뷰");
    expect(translateText("Sign in required.", "ko")).toBe("로그인이 필요합니다.");

    expect(translateText("Validation", "vi")).toBe("Kiểm định");
    expect(translateText("Eligible official races", "vi")).toBe("Cuộc đua chính thức đủ điều kiện");
    expect(translateText("PERMISSION PENDING", "vi")).toBe("Đang chờ cấp quyền");
    expect(translateText("Post-meet reviews", "vi")).toBe("Đánh giá sau giải");
    expect(translateText("Sign in required.", "vi")).toBe("Bạn cần đăng nhập.");
  });

  it("uses natural high-visibility sports terminology", () => {
    expect(translateText("Performance workspace", "ko")).toBe("경기력 분석 공간");
    expect(translateText("Your swim circle", "ko")).toBe("나의 수영 친구");
    expect(translateText("Performance workspace", "vi")).toBe("Không gian phân tích thành tích");
    expect(translateText("Your swim circle", "vi")).toBe("Nhóm bơi của bạn");
    expect(translateText("Dryland disciplined", "vi")).toBe("Kỷ luật tập thể lực");
    expect(translateText("10 gym sessions logged.", "vi")).toBe("Đã ghi 10 buổi tập thể lực.");
  });

  it("uses natural governance and security terminology", () => {
    expect(translateText("UNTRAINED", "ko")).toBe("머신러닝 모델 미학습");
    expect(translateText("Conservative deterministic forecasts are in production. No machine-learning challenger has been promoted.", "ko"))
      .toContain("후보 모델");

    expect(translateText("UNTRAINED", "vi")).toBe("MÔ HÌNH MÁY HỌC CHƯA ĐƯỢC HUẤN LUYỆN");
    expect(translateText("Protected APIs", "vi")).toBe("API được bảo vệ");
    expect(translateText("Public endpoints reject unexpected fields, oversized bodies, cross-origin writes, and excessive traffic.", "vi"))
      .toBe("API công khai từ chối trường dữ liệu không mong đợi, nội dung quá lớn, yêu cầu ghi từ nguồn khác và lưu lượng vượt mức.");
  });
});
