// src/lib/map/layerManager.ts
import type { Map } from 'ol';
import type { LayerOL } from '$lib/components/openlayers/layerOL';
import { layerManager } from '$lib/shared/openlayers/shared.svelte';

export function addOLLayer(map: Map, entry: LayerOL) {
  map.addLayer(entry.layer);
  layerManager.selectedLayers.push(entry);
}

export function removeOLLayer(map: Map, id: string) {
  const layerEntryIndex = layerManager.selectedLayers.findIndex(layerEntry => layerEntry.id === id);
  if (layerEntryIndex !== -1) {
    const layerEntry = layerManager.selectedLayers[layerEntryIndex];
    map.removeLayer(layerEntry.layer);
    layerManager.selectedLayers.splice(layerEntryIndex, 1);
  }
};
export function containsOLLayer(): boolean {
  return false;
}
/*
export function toggleLayerVisibility(id: string) {
  layerEntries.update(list => {
    return list.map(l => {
      if (l.id === id) {
        l.visible = !l.visible;
        l.layer.setVisible(l.visible);
      }
      return l;
    });
  });
}

export function updateOpacity(id: string, opacity: number) {
  layerEntries.update(list => {
    return list.map(l => {
      if (l.id === id) {
        l.opacity = opacity;
        l.layer.setOpacity(opacity);
      }
      return l;
    });
  });
}
*/