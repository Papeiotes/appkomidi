export function pickerHtml(lat: number, lng: number) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const map = L.map('map').setView([${lat}, ${lng}], 14);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);
const marker = L.marker([${lat}, ${lng}], {draggable:true}).addTo(map);
function send(ll){ window.ReactNativeWebView.postMessage(JSON.stringify({lat:ll.lat,lng:ll.lng})); }
marker.on('dragend', () => send(marker.getLatLng()));
map.on('click', (e) => { marker.setLatLng(e.latlng); send(e.latlng); });
</script></body></html>`;
}

export function liveHtml(lat: number, lng: number) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const map = L.map('map').setView([${lat}, ${lng}], 14);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);
let van = L.circleMarker([${lat}, ${lng}], {radius:9, color:'#142018', weight:3, fillColor:'#1b7f4a', fillOpacity:0, opacity:0}).addTo(map);
let anim = 0;
let framed = "";
window.setVan = (lat, lng) => {
  const hidden = van.options.fillOpacity === 0;
  van.setStyle({opacity:1, fillOpacity:1});
  const from = hidden ? L.latLng(lat, lng) : van.getLatLng();
  const started = performance.now();
  cancelAnimationFrame(anim);
  const step = (now) => {
    const t = Math.min(1, (now - started) / 800);
    van.setLatLng([from.lat + (lat - from.lat) * t, from.lng + (lng - from.lng) * t]);
    if (t < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
};
window.setStops = (stops) => {
  if (window.pins) map.removeLayer(window.pins);
  window.pins = L.layerGroup();
  (stops || []).forEach((stop) => {
    L.circleMarker([stop.lat, stop.lng], {
      radius: stop.active ? 11 : 7,
      color: stop.active ? "#e39b2b" : "#1b7f4a",
      weight: 3,
      fillColor: stop.active ? "#1b7f4a" : "#ffffff",
      fillOpacity: 1,
    }).addTo(window.pins);
  });
  window.pins.addTo(map);
  const signature = (stops || []).map((stop) => stop.id).join("|");
  if (signature && signature !== framed) {
    framed = signature;
    if (stops.length === 1) map.setView([stops[0].lat, stops[0].lng], 15);
    else map.fitBounds(stops.map((stop) => [stop.lat, stop.lng]), { padding: [36, 36], maxZoom: 16 });
  }
};
window.setLine = (pairs) => {
  if (window.line) map.removeLayer(window.line);
  if (!pairs || pairs.length < 2) return;
  window.line = L.polyline(pairs, {color:"#1b7f4a", weight:4}).addTo(map);
};
</script></body></html>`;
}
