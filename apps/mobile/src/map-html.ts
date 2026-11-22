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
let van = L.circleMarker([${lat}, ${lng}], {radius:8, color:'#1c2416', fillColor:'#e39b2b', fillOpacity:1}).addTo(map);
window.setVan = (lat, lng) => { van.setLatLng([lat, lng]); map.panTo([lat, lng]); };
window.setLine = (pairs) => {
  if (window.line) map.removeLayer(window.line);
  window.line = L.polyline(pairs, {color:'#2f4a34', weight:4}).addTo(map);
};
</script></body></html>`;
}
