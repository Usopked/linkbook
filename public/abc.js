import fs from "fs";

// Node.js 18 이상에서는 fetch가 기본 제공됨
// import fetch from "node-fetch"; ← 이 줄 삭제

const REST_KEY = process.env.KAKAO_REST_KEY;
if (!REST_KEY) {
  console.error("❌ KAKAO_REST_KEY 환경변수가 없습니다.");
  process.exit(1);
}

const libraries = JSON.parse(fs.readFileSync("libraries.json", "utf-8"));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocodeAddress(address) {
  if (!address || address.trim() === "") return null;

  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${REST_KEY}` },
    });

    if (!res.ok) {
      console.error("❌ Geocoding 실패:", address, await res.text());
      return null;
    }

    const data = await res.json();
    if (data.documents && data.documents.length > 0) {
      const { x, y } = data.documents[0];
      return { lat: parseFloat(y), lng: parseFloat(x) };
    }
    return null;
  } catch (err) {
    console.error("❌ 요청 에러:", address, err);
    return null;
  }
}

async function main() {
  const results = [];

  for (const [i, lib] of libraries.entries()) {
    console.log(`📍 ${i + 1}/${libraries.length} → ${lib.name}`);

    const coords = await geocodeAddress(lib.address);
    if (coords) {
      results.push({
        name: lib.name,
        address: lib.address,
        lat: coords.lat,
        lng: coords.lng,
      });
    }

    await sleep(120); // rate limit 방지
  }

  fs.writeFileSync(
    "libraries_with_coords.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  console.log("✅ 변환 완료! → libraries_with_coords.json 생성됨");
}

main();