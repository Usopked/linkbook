"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type Library = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  region1: string | null;
  region2: string | null;
  region3: string | null;
};

export default function Home() {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<any>(null);
  const dataRef = useRef<Library[] | null>(null);

  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const openInfoWindowRef = useRef<any>(null); // ✅ 열린 인포윈도우 추적

  const clearAll = () => {
    markersRef.current.forEach((m) => m.setMap && m.setMap(null));
    overlaysRef.current.forEach((o) => o.setMap && o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];
  };

  const fetchData = async () => {
    if (dataRef.current) return;
    const res = await fetch("/libraries_with_region.json");
    if (!res.ok) {
      console.error("Failed to fetch library data");
      return;
    }
    dataRef.current = await res.json();
  };

  // 줌 레벨에 따라 그룹 키 선택
  const pickGroupKey = (level: number, lib: Library) => {
    if (level > 9) {
      // 많이 축소 → 도 단위
      return lib.region1;
    } else if (level > 7) {
      // 중간 확대 → 시군구 단위
      return lib.region2;
    } else if (level > 5) {
      // 더 확대 → 읍면동 단위
      return lib.region3 || null;
    } else {
      // 최대로 확대 → 개별 도서관
      return null;
    }
  };

  const calcCenter = (items: Library[]) => {
    const n = items.length || 1;
    const lat = items.reduce((s, i) => s + (i.lat || 0), 0) / n;
    const lng = items.reduce((s, i) => s + (i.lng || 0), 0) / n;
    return new (window as any).kakao.maps.LatLng(lat, lng);
  };

  const render = async () => {
    const map = mapRef.current;
    if (!map) return;

    await fetchData();
    const libraries = dataRef.current || [];
    clearAll();

    const level = map.getLevel();

    if (level <= 5) {
      // 개별 도서관 표시
      libraries.forEach((lib) => {
        const pos = new (window as any).kakao.maps.LatLng(lib.lat, lib.lng);
        const marker = new (window as any).kakao.maps.Marker({ position: pos, title: lib.name });

        const infowindow = new (window as any).kakao.maps.InfoWindow({
          content: `
            <div style="padding:6px 10px;background:#fff;color:#000;border:1px solid #333;border-radius:6px;font-weight:bold;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;">
              ${lib.name}
            </div>
          `,
        });

        (window as any).kakao.maps.event.addListener(marker, "click", () => {
          if (openInfoWindowRef.current) {
            openInfoWindowRef.current.close();
          }
          infowindow.open(map, marker);
          openInfoWindowRef.current = infowindow;
        });

        marker.setMap(map);
        markersRef.current.push(marker);
      });
      return;
    }

    // 그룹핑
    const groupMap = new Map<string, Library[]>();
    libraries.forEach((lib) => {
      const key = pickGroupKey(level, lib);
      if (!key) return;
      const arr = groupMap.get(key) || [];
      arr.push(lib);
      groupMap.set(key, arr);
    });

    groupMap.forEach((items, key) => {
      const center = calcCenter(items);
      const count = items.length;

      if (count === 1) {
        // ✅ 그룹에 객체가 하나뿐이면 묶지 않고 개별 도서관 표시
        const lib = items[0];
        const pos = new (window as any).kakao.maps.LatLng(lib.lat, lib.lng);
        const marker = new (window as any).kakao.maps.Marker({ position: pos, title: lib.name });

        const infowindow = new (window as any).kakao.maps.InfoWindow({
          content: `
            <div style="padding:6px 10px;background:#fff;color:#000;border:1px solid #333;border-radius:6px;font-weight:bold;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;">
              ${lib.name}
            </div>
          `,
        });

        (window as any).kakao.maps.event.addListener(marker, "click", () => {
          if (openInfoWindowRef.current) {
            openInfoWindowRef.current.close();
          }
          infowindow.open(map, marker);
          openInfoWindowRef.current = infowindow;
        });

        marker.setMap(map);
        markersRef.current.push(marker);
        return;
      }

      // ✅ 그룹에 여러 개가 있을 때만 묶음 표시
      const text = `(${count}) ${key}`;

      const marker = new (window as any).kakao.maps.Marker({ position: center, title: key });
      marker.setMap(map);
      markersRef.current.push(marker);

      const overlay = new (window as any).kakao.maps.CustomOverlay({
        position: center,
        content: `<div style="padding:6px 10px;background:#222;color:#fff;border-radius:14px;font-weight:600;font-size:13px;white-space:nowrap;">${text}</div>`,
        xAnchor: 0.5,
        yAnchor: 1.2,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);

      // 클릭 시 확대
      (window as any).kakao.maps.event.addListener(marker, "click", () => {
        map.setLevel(Math.max(level - 4, 1), { animate: { duration: 200 } });
        map.setCenter(center);
      });
      (window as any).kakao.maps.event.addListener(overlay, "click", () => {
        map.setLevel(Math.max(level - 4, 1), { animate: { duration: 200 } });
        map.setCenter(center);
      });

      // ✅ 더블클릭 시 두 배 확대
      (window as any).kakao.maps.event.addListener(marker, "dblclick", () => {
        map.setLevel(Math.max(level - 8, 1), { animate: { duration: 200 } });
        map.setCenter(center);
      });
      (window as any).kakao.maps.event.addListener(overlay, "dblclick", () => {
        map.setLevel(Math.max(level - 8, 1), { animate: { duration: 200 } });
        map.setCenter(center);
      });
    });
  };

  const initializeMap = () => {
    if (typeof window !== "undefined" && (window as any).kakao && !mapLoaded) {
      (window as any).kakao.maps.load(() => {
        const container = document.getElementById("map");
        const options = {
          center: new (window as any).kakao.maps.LatLng(36.5, 127.8),
          level: 13,
        };
        mapRef.current = new (window as any).kakao.maps.Map(container, options);
        setMapLoaded(true);
        render();

        // ✅ 줌 변경 시 열린 인포윈도우 닫기
        (window as any).kakao.maps.event.addListener(mapRef.current, "zoom_changed", () => {
          if (openInfoWindowRef.current) {
            openInfoWindowRef.current.close();
            openInfoWindowRef.current = null;
          }
          render();
        });

        // ✅ 드래그 종료 시 열린 인포윈도우 닫기
        (window as any).kakao.maps.event.addListener(mapRef.current, "dragend", () => {
          if (openInfoWindowRef.current) {
            openInfoWindowRef.current.close();
            openInfoWindowRef.current = null;
          }
          render();
        });
      });
    }
  };

  useEffect(() => {
    if (mapLoaded) render();
  }, [mapLoaded]);
  
   return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&libraries=services&autoload=false`}
        strategy="afterInteractive"
        onLoad={initializeMap}
      />
      <div id="map" style={{ width: "100%", height: "100vh" }} />
    </>
  );
}