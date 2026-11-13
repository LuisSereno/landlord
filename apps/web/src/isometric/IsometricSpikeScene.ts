import Phaser from "phaser";
import { CHARACTER_LIFT_LUT, CHARACTER_RENDER_SCALE } from "./visual-scale";
import { readVisualMood } from "../visual-mood";
import {
  type AgentId,
  type BuildingAssetState,
  type BuildingAssetV2,
  type BuildingPhysicalOrientation,
  type ConstructionStage,
  type RuntimeAssetManifestV2,
  type SceneryAssetV1,
  type ViewProjectionV2,
} from "@landlord/shared";
import { BLENDER_ASSETS, PROCEDURAL_ASSETS } from "../assets/runtime-assets";
import {
  hasRealVariants,
  resolveBuildingVariant,
  variantAsAsset,
  variantTextureKey,
} from "../assets/building-variants";
import {
  DistrictTextureCache,
  VARIANT_CACHE_BUDGET_BYTES,
  decodedTextureBytes,
  type DistrictAssetMetrics,
} from "../assets/district-texture-cache";
import { deriveWorldIndicators } from "../ui/world-indicators";
import {
  CODE_PALETTE,
  MAP_COLORS,
  ROLE_COLORS,
  USE_COLORS,
  ZONING_COLORS,
  type MapOverlay,
} from "../ui/overlay-catalog";
import {
  planPropertyGrounds,
  propertyGroundsCacheKey,
  type GroundDescriptor,
  type GroundFamily,
} from "./property-grounds";
import { constructionStageMassing, constructionVisualStage } from "./construction-stages";
import {
  crewAnimationFrameKey,
  crewSpriteObservations,
  type CrewSpriteObservation,
} from "./crew-presence";
import { planGround, type GroundPlan } from "../visual-slice/ground";
import {
  CROSSING_TEXTURE,
  paintCrossing,
  paintGround,
  type GroundBounds,
  type TerrainStage,
} from "../visual-slice/terrain-paint";
import type { SliceLot, VisualSliceLayout } from "../visual-slice/layout";
import {
  assetFor,
  applyQaStateOverride,
  buildingSpritePlan,
  depthForAsset,
  depthForFootprintCells,
  footprintCenter,
  footprintVisualCenter,
  originFromPivot,
  resolveBuildingVisual,
  selectBuildingTextureKey,
  spriteKeyFor,
  spriteScaleFor,
  spriteScaleForDomainFootprint,
} from "./building-sprites";
import {
  gridToScreen,
  pickGridCell,
  REFERENCE_LAYOUT,
  type GridCell,
  type IsometricLayout,
  type ScreenPoint,
} from "./coordinates";
import { gridEdgeToScreenLine, parcelBoundaryEdges } from "./parcel-geometry";
import { nearestCandidateToCell } from "../ui/placement";
import {
  buildGameplayVisualModel,
  contextActorRenderCell,
  type GameplayContextActor,
  type GameplayParkedVehicle,
  type GameplayVisualModel,
} from "./gameplay-visual-adapter";

const COLORS = MAP_COLORS;
/** V.d-7C · vocabulario de entorno: cada tipo de recinto se dibuja distinto, no sólo distinto color. */
const GROUND_COLORS: Record<string, number> = {
  garden: 0x69a86b,
  path: 0xb9c2cf,
  hedge: 0x3f6b4a,
  fence: 0x8a6f4e,
  tree: 0x4f8f5a,
  yard: 0x7f8fa6,
  hardstanding: 0x9aa4b2,
  "service-yard": 0x6b7280,
  "loading-area": 0xc9a227,
  pallets: 0xb07a3c,
  containers: 0x4a7ba7,
} as const;
/**
 * V.d-7C · coreografía de obra. Paleta Graphic Civic propia: tierra para la cimentación, crema de
 * muro para la estructura a medio hacer y andamio en línea fina. Nada de esto cambia el progreso
 * autoritativo: es lectura del progreso que ya existe.
 *
 * V.k.3 · las cuadrillas ya no están aquí: se leen como personas con el avatar horneado de obra,
 * así que los cuatro colores de anillo quedaron sin superficie que pintar.
 */
const CONSTRUCTION_COLORS = {
  excavation: 0x2f2621,
  pad: 0x8a6f4e,
  massing: 0xead7a1,
  scaffold: 0xc9b98a,
} as const;

const STRUCTURE_TEXTURE_KEY = "benchmark-structure-marker";
const AGENT_TEXTURE_KEY = "benchmark-agent-marker";
/**
 * Avisos de salud que viven en el marcador de agente (muerto gris, herido ámbar). Son también los
 * estados que conservan el marcador aunque el agente tenga sprite: ningún clip los representa.
 */
const AGENT_STATE_TINTS: Record<string, number> = { dead: 0x555555, injured: 0xe0a23b };
const TILE_TEXTURE_KEY = "district-ground-tiles";
const CROSSING_TEXTURE_KEY = "district-crossings";
const SLICE_SHADOW_TEXTURE_KEY = "slice-contact-shadow";
/** Las capas de terreno viven por debajo de cualquier objeto con depth isométrico. */
const TERRAIN_DEPTH = 100;
/** Marca de vial por encima de todos los tiles de calzada, por debajo del mobiliario. */
const ROAD_MARKING_DEPTH = TERRAIN_DEPTH + 250;
/**
 * Profundidad de las parcelas en obra. La cesión de suelo es una decisión de la simulación; el
 * contorno ámbar es presentación y sólo aparece en el Visual Slice.
 */
const CONSTRUCTION_SITE_DEPTH = TERRAIN_DEPTH + 300;
/**
 * V.d-7C · la colocación tiene capa propia, por encima del overlay de datos y del fantasma. No se
 * reutiliza `mapGraphics` (overlays/selección): así cancelar, confirmar, cambiar de distrito o apagar
 * la escena siempre limpian el modo sin tocar el resto del mapa.
 */
const PLACEMENT_GHOST_DEPTH = 20_450;
const PLACEMENT_DEPTH = 20_500;
const PLACEMENT_LABEL_DEPTH = 20_550;
/**
 * V.k.3 · la etiqueta de obra cuelga sobre los sprites: `depthForCell` llega a 126 693 en la retícula
 * de 64×64, así que el contenedor compartido con la colocación (20 550) quedaba enterrado por los
 * edificios del distrito.
 */
const CONSTRUCTION_LABEL_DEPTH = 1_000_000;
/**
 * Constante de deslizamiento de las cuadrillas. La proyección llega cada 2 ticks y el destino salta
 * de golpe; este tiempo de relajación es presentación pura y no añade simulación.
 */
const CREW_INTERPOLATION_MS = 120;
/** El fantasma es una promesa, no un edificio: semi-transparente y distinguible del terminado. */
const PLACEMENT_GHOST_ALPHA = 0.55;
/**
 * V.d-7C · lenguaje de colocación original: azul para el contexto catastral, verde cívico para las
 * candidatas legales, ámbar sólo para la seleccionada. Nunca verde/rojo como única señal (§53): la
 * marca numerada y el borde grueso también distinguen.
 */
const PLACEMENT_COLORS = {
  context: 0x6fa8dc,
  candidate: 0x4db6ac,
  recommended: 0x7ad1c4,
  selected: 0xf2c14e,
} as const;
/**
 * Los dos bundles entran por el mismo parser: el procedural ya es V2 y el de Blender sigue siendo V1,
 * que se convierte de forma explícita. Aquí no hay rama silenciosa por versión.
 */
const ASSETS = PROCEDURAL_ASSETS;
const ASSETS_BLENDER = BLENDER_ASSETS;
/** Azimut fijo de la cámara isométrica del juego. Un asset que no lo declare no se dibuja. */
const SCENE_AZIMUTH = 45;

/** Las piezas Kenney están modeladas a escala pequeña; el slice las lleva a presencia de calle. */
const SLICE_BUILDING_SCALE = 1.45;
const FPS_WINDOW_MS = 500;

export type IsometricSceneOptions = {
  /** Capa de presentación del Visual Slice; no altera la simulación. */
  visualSlice?: VisualSliceLayout;
  /** Personajes de la capa de presentación (`?characters=1`). */
  sliceCharacters?: boolean;
  /**
   * Capa del suelo hasta la que se hornea (evidence BEFORE/AFTER de WP4.15-V.b0). `full` es el
   * estado normal; los demás valores sirven para aislar qué aporta cada capa.
   */
  terrainStage?: TerrainStage | undefined;
  /** Cuadrícula de edición por celda. La captura de referencia del gate no debe parecer un editor. */
  showGrid?: boolean | undefined;
};

/**
 * Sprite de un miembro de cuadrilla. `target` es el destino publicado por la última proyección: el
 * sprite se desliza hacia él en `update()`, porque la proyección llega cada 2 ticks y el tramo
 * autoritativo dura 10.
 */
type CrewSpriteEntry = {
  image: Phaser.GameObjects.Image;
  /** Clave horneada ya aplicada: `setTexture` sólo cuando cambia, como en los demás pools. */
  key: string;
  target: ScreenPoint;
  cell: GridCell;
};

/** Identidad semántica recibida desde la UI; las celdas se resuelven contra la proyección actual. */
export type MapSelectionTarget =
  | { kind: "parcel"; parcelId: string }
  | { kind: "building"; buildingId: string }
  | { kind: "construction"; siteId: string }
  | { kind: "facility"; facilityId: string }
  | { kind: "public-space"; publicSpaceId: string }
  | {
      kind: "site-assembly";
      parcelIds: readonly string[];
      candidateParcelIds: readonly string[];
    };

/**
 * V.d-7C · qué debe dibujar el modo de colocación. Son candidatas ya validadas por el motor: Phaser
 * no decide si una huella es legal, sólo la pinta y resuelve cuál está más cerca del puntero.
 */
export type MapPlacementTarget = {
  buildingType: string;
  parcelIds: readonly string[];
  candidates: readonly {
    id: string;
    footprintCells: readonly GridCell[];
    orientation: number;
    recommended: boolean;
  }[];
  selectedCandidateId: string | null;
};

type CameraTestApi = {
  configure(camera: { zoom: number; scrollX: number; scrollY: number }): void;
  getCamera(): { zoom: number; scrollX: number; scrollY: number };
  getCellScreenPoint(cell: GridCell): ScreenPoint;
  getEntityScreenPoint(id: string): ScreenPoint | null;
  getWorldPoint(point: ScreenPoint): ScreenPoint;
  getSelectedCell(): GridCell | null;
  centerOnCell(cell: GridCell): void;
  /** Inyecta una proyección (captura QA): atraviesa el mismo camino de render que la partida real. */
  injectProjection(projection: ViewProjectionV2): void;
};

declare global {
  interface Window {
    __landlordCameraTest?: CameraTestApi;
    __visualSliceReady?: boolean;
    __visualSliceObjects?: number;
    __visualSliceFps?: number;
    __visualSlicePerformance?: {
      currentFps: number;
      samples: number[];
      objectCount: number;
    };
    /** V.j.6 · métricas de carga/memoria de variantes por distrito (D-102). */
    __districtAssetStats?: () => DistrictAssetMetrics;
    /** V.j.8 · sólo evidencia QA: estado visual forzado para captura 9×3×4 (no gameplay). */
    __landlordQaState?: "complete" | "construction" | "damaged" | "burning";
    __landlordQaRefresh?: () => void;
    /**
     * V.d-7C · sonda observacional del modo de colocación (sólo con `?cameraTest=1`). Lee qué se
     * está mostrando; no selecciona candidatas, no muta el estado y no sustituye ningún click.
     */
    __landlordPlacementTest?: () => {
      candidates: number;
      selectedId: string | null;
      selectedOrientation: number | null;
      ghostVisible: boolean;
      ghostCenter: { x: number; y: number } | null;
      selectedFootprint: { x: number; y: number }[] | null;
      buildingType: string | null;
      parcelIds: string[];
    };
    /** Sonda de gameplay (WP4.15-V.c.1): objetos renderizados y rebakes de suelo. */
    __gameplayVisualStats?: () => {
      buildings: number;
      placementObjects: number;
      placementLabelPool: number;
      placementDraws: number;
      sceneChildren: number;
      decorations: number;
      roadCells: number;
      junctions: number;
      crossings: number;
      streetLights: number;
      trafficLights: number;
      benches: number;
      trashCans: number;
      parkedVehicles: number;
      trees: number;
      /** V.k.3 · sprites de cuadrilla vivos en el pool (agentes asignados a una obra). */
      crewSprites: number;
      totalSprites: number;
      groundRebakes: number;
      groundBakeLastMs: number;
      groundBakeMaxMs: number;
    };
  }
}

/** El catálogo del mapa vive en la UI para que la leyenda y el render compartan fuente. */
export type { MapOverlay } from "../ui/overlay-catalog";

export class IsometricSpikeScene extends Phaser.Scene {
  private readonly layout: IsometricLayout = REFERENCE_LAYOUT;
  private readonly sliceLayout: VisualSliceLayout | undefined;
  private readonly sliceCharacters: boolean;
  private readonly terrainStage: TerrainStage;
  private readonly showGrid: boolean;
  private readonly logFps: boolean;
  private groundPlan: GroundPlan | null = null;
  private readonly screenCenters: ScreenPoint[] = [];
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private structureBlitter?: Phaser.GameObjects.Blitter;
  private agentBlitter?: Phaser.GameObjects.Blitter;
  private structureBobs: Phaser.GameObjects.Bob[] = [];
  private agentBobs: Phaser.GameObjects.Bob[] = [];
  private buildingSprites = new Map<string, Phaser.GameObjects.Image>();
  private pendingVariantTextures = new Map<string, { bytes: number; districtId: string }>();
  private variantCache = new DistrictTextureCache(VARIANT_CACHE_BUDGET_BYTES);
  private sliceObjects: Phaser.GameObjects.GameObject[] = [];
  private assetsReady = false;
  /**
   * El registro de texturas es asíncrono y React puede destruir el motor con decodificaciones en
   * vuelo. Sin esta bandera, la continuación llama a `createCanvas` sobre un gestor que ya no tiene
   * `game` y Phaser lanza `Cannot read properties of null (reading 'renderer')`.
   */
  private sceneDestroyed = false;
  private debugText?: Phaser.GameObjects.Text;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private selectedCell: GridCell | null = null;
  private selectionTarget: MapSelectionTarget | null = null;
  private placementTarget: MapPlacementTarget | null = null;
  private placementGraphics?: Phaser.GameObjects.Graphics;
  private constructionLabels?: Phaser.GameObjects.Container;
  /** Caché de entornos: sólo se recalcula cuando cambia la geometría autoritativa de la propiedad. */
  private groundsByProperty = new Map<string, GroundDescriptor[]>();
  private placementLabels?: Phaser.GameObjects.Container;
  private placementGhost?: Phaser.GameObjects.Image;
  private placementCandidateListener?: (candidateId: string) => void;
  /** Contador de repintados, para detectar redraws por frame en modo de colocación. */
  private placementDrawCount = 0;
  private projection: ViewProjectionV2 | null = null;
  private overlay: MapOverlay = "none";
  private cellPickedListener?: (cell: GridCell) => void;
  private entityPickedListener?: (target: {
    kind: "building" | "construction";
    id: string;
  }) => void;
  /** Marca del handler de sprite para que el `pointerup` global no resuelva también el suelo. */
  private suppressGroundPick = false;
  private indicatorListener?: (target: { parcelId: string; buildingId?: string }) => void;
  private indicatorLayer?: Phaser.GameObjects.Container;
  private indicatorEntries: Array<{
    object: Phaser.GameObjects.Container;
    critical: boolean;
  }> = [];
  private indicatorTooltip?: Phaser.GameObjects.Text;
  private indicatorSignature = "";
  private lastIndicatorZoom = 1;
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  private fpsAccumulator = 0;
  private fpsFrames = 0;
  /** Modelo visual del gameplay derivado de la proyección; nulo en modo Visual Slice. */
  private gameplayVisual: GameplayVisualModel | null = null;
  private gameplayGroundKey: string | null = null;
  private groundRebakeCount = 0;
  private groundBakeLastMs = 0;
  private groundBakeMaxMs = 0;
  private buildingArchetypes = new Map<string, string>();
  private decorSprites: Phaser.GameObjects.Image[] = [];
  /** Decalcos de cruces derivados de la proyección; se reconstruyen sólo con la geometría vial. */
  private roadMarkingSprites: Phaser.GameObjects.Image[] = [];
  private streetFurnitureSprites = new Map<string, Phaser.GameObjects.Image>();
  private parkedVehicleSprites = new Map<string, Phaser.GameObjects.Image>();
  private ambientActorSprites = new Map<string, Phaser.GameObjects.Image>();
  private publicSpaceFurnitureSprites = new Map<string, Phaser.GameObjects.Image>();
  private parcelDressingSprites = new Map<string, Phaser.GameObjects.Image>();
  /**
   * V.k.3 · pool propio de cuadrillas. Va aparte de `ambientActorSprites` porque esos son población
   * ambiental derivada del modelo visual (estable, keyed por id de scena) y éstos son agentes del
   * roster que se crean, mueven y despiden con la obra.
   */
  private crewSprites = new Map<AgentId, CrewSpriteEntry>();
  /** Lectura pura de la última proyección: también es la memoria de rumbo entre proyecciones. */
  private crewObservations = new Map<AgentId, CrewSpriteObservation>();

  public constructor(options: IsometricSceneOptions = {}) {
    super({ key: "IsometricSpikeScene" });
    this.sliceLayout = options.visualSlice;
    this.sliceCharacters = options.sliceCharacters ?? false;
    this.terrainStage = options.terrainStage ?? "full";
    this.showGrid = options.showGrid ?? false;
    this.logFps = new URLSearchParams(window.location.search).get("fpsDebug") === "1";
  }

  public create(): void {
    this.buildScreenCenterCache();
    this.groundPlan = this.sliceLayout
      ? planGround(this.sliceLayout, this.layout.mapWidth, this.layout.mapHeight)
      : null;
    this.bakeGround();
    this.mapGraphics = this.add.graphics().setDepth(20_000);
    this.placementGraphics = this.add.graphics().setDepth(PLACEMENT_DEPTH);
    this.placementLabels = this.add.container(0, 0).setDepth(PLACEMENT_LABEL_DEPTH);
    this.constructionLabels = this.add.container(0, 0).setDepth(CONSTRUCTION_LABEL_DEPTH);
    this.createMarkerTexture(STRUCTURE_TEXTURE_KEY, 16, 16, "#d97757");
    this.createMarkerTexture(AGENT_TEXTURE_KEY, 4, 4, "#8fcae7");
    this.structureBlitter = this.add.blitter(0, 0, STRUCTURE_TEXTURE_KEY).setDepth(15_000);
    this.agentBlitter = this.add.blitter(0, 0, AGENT_TEXTURE_KEY).setDepth(15_000);
    this.drawOverlay();
    this.cameras.main.setZoom(1);
    /** La cámara debe poder panear y centrar el distrito completo en cualquier zoom. */
    this.cameras.main.setBounds(-4096, -4096, 16_384, 16_384);
    this.installCameraTestHook();
    window.__gameplayVisualStats = () => ({
      buildings: this.buildingSprites.size,
      decorations: this.decorSprites.length,
      roadCells: this.gameplayVisual?.roadVisuals.length ?? 0,
      junctions:
        this.gameplayVisual?.roadVisuals.filter(
          (road) => road.shape === "t_junction" || road.shape === "intersection",
        ).length ?? 0,
      crossings: this.gameplayVisual?.groundPlan.roadMarkings?.length ?? 0,
      streetLights:
        this.gameplayVisual?.streetFurniture.filter((entry) => entry.kind === "street_light")
          .length ?? 0,
      trafficLights:
        this.gameplayVisual?.streetFurniture.filter((entry) => entry.kind === "traffic_light")
          .length ?? 0,
      benches:
        this.gameplayVisual?.streetFurniture.filter((entry) => entry.kind === "bench").length ?? 0,
      trashCans:
        this.gameplayVisual?.streetFurniture.filter((entry) => entry.kind === "trash_can").length ??
        0,
      parkedVehicles: this.gameplayVisual?.parkedVehicles.length ?? 0,
      trees: this.decorSprites.length,
      placementObjects:
        (this.placementTarget ? 1 : 0) +
        (this.placementLabels?.list.filter((entry) => (entry as Phaser.GameObjects.Text).visible)
          .length ?? 0) +
        (this.placementGhost && this.placementGhost.visible ? 1 : 0),
      /** El pool de etiquetas está acotado por la página de candidatas, no por los ciclos. */
      placementLabelPool: this.placementLabels?.list.length ?? 0,
      placementDraws: this.placementDrawCount,
      sceneChildren: this.children.list.length,
      crewSprites: this.crewSprites.size,
      totalSprites:
        this.buildingSprites.size +
        this.decorSprites.length +
        this.streetFurnitureSprites.size +
        this.parkedVehicleSprites.size +
        this.roadMarkingSprites.length +
        this.crewSprites.size +
        this.structureBobs.length +
        this.agentBobs.length,
      groundRebakes: this.groundRebakeCount,
      groundBakeLastMs: this.groundBakeLastMs,
      groundBakeMaxMs: this.groundBakeMaxMs,
    });
    window.__districtAssetStats = () => this.variantCache.metrics();
    window.__landlordQaRefresh = () => this.syncBuildingSprites();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("wheel", this.handleWheel, this);
    /**
     * `game.destroy()` no emite SHUTDOWN: los `Systems` avisan con DESTROY y luego quitan los
     * listeners. Es la señal de que las continuaciones asíncronas ya no tienen dónde escribir.
     */
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.sceneDestroyed = true;
    });
    void this.registerBuildingTextures();
  }

  public override update(time: number, delta: number): void {
    this.fpsFrames += 1;
    this.fpsAccumulator += delta;
    if (this.fpsAccumulator >= FPS_WINDOW_MS) {
      const currentFps = Math.round((this.fpsFrames * 1000) / this.fpsAccumulator);
      window.__visualSliceFps = currentFps;
      if (!window.__visualSlicePerformance) {
        window.__visualSlicePerformance = {
          currentFps,
          samples: [],
          objectCount: this.sliceObjects.length,
        };
      } else {
        window.__visualSlicePerformance.currentFps = currentFps;
        window.__visualSlicePerformance.samples.push(currentFps);
      }
      if (this.logFps) {
        window.console.info(
          `[FPS] ${currentFps}, samples: ${window.__visualSlicePerformance.samples.length}`,
        );
      }
      this.fpsFrames = 0;
      this.fpsAccumulator = 0;
    }
    this.updateGameplayStreetLifeVisibility();
    this.animateCrewSprites(time, delta);
    /**
     * V.d-UX · en zoom lejano se ocultan los avisos no críticos para no llenar la ciudad de
     * badges. Los críticos (incendio/colapso) siguen visibles siempre.
     */
    const zoom = this.cameras.main.zoom;
    if (Math.abs(zoom - this.lastIndicatorZoom) > 0.001) {
      this.lastIndicatorZoom = zoom;
      const showSecondary = zoom >= 0.7;
      for (const entry of this.indicatorEntries)
        entry.object.setVisible(entry.critical || showSecondary);
    }
    if (!this.cursors) return;
    const camera = this.cameras.main;
    const speed = 8 / camera.zoom;
    if (this.cursors.left?.isDown) camera.scrollX -= speed;
    if (this.cursors.right?.isDown) camera.scrollX += speed;
    if (this.cursors.up?.isDown) camera.scrollY -= speed;
    if (this.cursors.down?.isDown) camera.scrollY += speed;
  }

  public setProjection(projection: ViewProjectionV2): void {
    // React puede entregar el último efecto de proyección durante el desmontaje
    // del canvas (por ejemplo, al cambiar Día/Noche). Phaser ya ha liberado el
    // TextureManager en ese instante y la escena no debe volver a pintar.
    if (!this.sys?.isActive() || !this.textures) return;
    const districtChanged =
      this.projection !== null &&
      this.projection.observedDistrictId !== projection.observedDistrictId;
    this.projection = projection;
    if (!this.sliceLayout) this.syncGameplayVisual();
    this.syncBuildingSprites();
    /**
     * V.k.3 · las cuadrillas van antes que el blitter, que retira el marcador de quien ya tiene
     * sprite, y antes del repintado, porque la etiqueta de obra cuenta desde sus observaciones.
     */
    this.syncCrewSprites();
    this.updateBlitterPositions();
    this.drawOverlay();
    this.syncWorldIndicators();
    if (districtChanged && this.placementTarget) this.setPlacement(null);
    else if (this.placementTarget) {
      /** El solar desapareció de la vista (o de la partida): el modo no puede quedar flotando. */
      const known = new Set<string>((projection.economy?.parcels ?? []).map((parcel) => parcel.id));
      if (this.placementTarget.parcelIds.some((id) => !known.has(id))) this.setPlacement(null);
    }
  }

  /** Cambia sólo la presentación; la proyección y el estado de simulación permanecen intactos. */
  public setVisualMood(mood: "day" | "night"): void {
    if (!this.sys.isActive()) return;
    this.cameras.main.setBackgroundColor(mood === "day" ? "#2b3542" : "#101827");
    this.repaintGround();
  }

  public setOverlay(overlay: MapOverlay): void {
    this.overlay = overlay;
    this.drawOverlay();
  }

  /** Selección dirigida desde la UI (notificaciones, fichas): sólo presentación. */
  public setSelectedCell(cell: GridCell | null): void {
    this.selectedCell = cell ? { ...cell } : null;
    this.selectionTarget = null;
    this.drawOverlay();
  }

  /** La selección UI es una entidad, no el anchor de una celda. */
  public setSelectionTarget(target: MapSelectionTarget | null): void {
    this.selectionTarget = target ? { ...target } : null;
    this.drawOverlay();
  }

  /**
   * V.d-7C · entrar/salir del modo de colocación. `null` limpia la capa y el fantasma: se llama al
   * confirmar, al cancelar, al cambiar de distrito y cuando la proyección deja de conocer el solar.
   */
  public setPlacement(target: MapPlacementTarget | null): void {
    this.placementTarget = target
      ? {
          buildingType: target.buildingType,
          parcelIds: [...target.parcelIds],
          candidates: target.candidates.map((candidate) => ({
            id: candidate.id,
            footprintCells: candidate.footprintCells.map((cell) => ({ ...cell })),
            orientation: candidate.orientation,
            recommended: candidate.recommended,
          })),
          selectedCandidateId: target.selectedCandidateId,
        }
      : null;
    this.drawPlacement();
  }

  /** El puntero elige candidata; la decisión de qué es legal sigue en el motor. */
  public setPlacementCandidateListener(listener: (candidateId: string) => void): void {
    this.placementCandidateListener = listener;
  }

  /** Entity picking is semantic; React receives identity and Phaser keeps geometry local. */
  public setEntityPickedListener(
    listener: (target: { kind: "building" | "construction"; id: string }) => void,
  ): void {
    this.entityPickedListener = listener;
  }

  /** Centra la cámara en una celda; respeta `prefers-reduced-motion`. */
  public focusCell(cell: GridCell): void {
    const world = gridToScreen(cell, this.layout);
    const camera = this.cameras.main;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) camera.setScroll(world.x - camera.width / 2, world.y - camera.height / 2);
    else camera.pan(world.x, world.y, 260, Phaser.Math.Easing.Sine.InOut);
  }

  /** Click en un indicador de mundo: navega al target sin decidir nada por el jugador. */
  public setIndicatorListener(
    listener: (target: { parcelId: string; buildingId?: string }) => void,
  ): void {
    this.indicatorListener = listener;
  }

  public setCellPickedListener(listener: (cell: GridCell) => void): void {
    this.cellPickedListener = listener;
  }

  private debugLabel(): string {
    const selected = this.selectedCell ? `${this.selectedCell.x},${this.selectedCell.y}` : "—";
    return `cell: ${selected} | zoom: ${this.cameras.main.zoom.toFixed(2)}`;
  }

  /**
   * Hornea el suelo del distrito una sola vez en una CanvasTexture con Canvas 2D. No se usa
   * Graphics: en Phaser 4 el horneado de Graphics (RenderTexture.draw / generateTexture) no resulta
   * fiable y el suelo ya desapareció de la escena una vez, dejando los edificios flotando.
   */
  private bakeGround(): void {
    const bounds = this.groundBounds();
    if (!this.textures.exists(TILE_TEXTURE_KEY)) {
      const texture = this.textures.createCanvas(TILE_TEXTURE_KEY, bounds.width, bounds.height);
      if (texture) {
        this.paintGroundInto(texture.context);
        texture.refresh();
      }
    }
    this.add.image(bounds.x, bounds.y, TILE_TEXTURE_KEY).setOrigin(0, 0).setDepth(0);
    /** Los decalcos viales son la capa 4: sólo aparecen en el horneado completo con calzadas. */
    if (this.groundPlan && this.terrainStage === "full" && this.groundPlan.crossings.length > 0) {
      this.drawCrossings();
    }
  }

  private paintGroundInto(context: CanvasRenderingContext2D): void {
    const startedAt = performance.now();
    paintGround({
      context,
      document: this.game.canvas.ownerDocument,
      layout: this.layout,
      bounds: this.groundBounds(),
      plan: this.groundPlan,
      stage: this.terrainStage,
      showGrid: this.showGrid,
      // El Visual Slice conserva sus aceras fixture; gameplay marca todo frente asphalt/no-asphalt.
      curbMode: this.sliceLayout ? "pavement" : "all_non_asphalt",
    });
    this.groundBakeLastMs = performance.now() - startedAt;
    this.groundBakeMaxMs = Math.max(this.groundBakeMaxMs, this.groundBakeLastMs);
  }

  /** Repinta la textura de suelo ya creada sin volver a instanciar la imagen del mapa. */
  private repaintGround(): void {
    // `Game.destroy()` invalida las texturas antes de que React haya terminado
    // de limpiar sus efectos. El repintado es sólo presentación, así que ese
    // último ciclo se descarta con seguridad.
    if (!this.sys?.isActive() || !this.textures) return;
    const existing = this.textures.exists(TILE_TEXTURE_KEY)
      ? (this.textures.get(TILE_TEXTURE_KEY) as Phaser.Textures.CanvasTexture)
      : undefined;
    if (existing?.context) {
      this.paintGroundInto(existing.context);
      existing.refresh();
      return;
    }
    this.bakeGround();
  }

  /**
   * Reconstruye el modelo visual del gameplay desde la proyección. Sólo repinta el suelo y las
   * decoraciones cuando cambia la clave de geometría, no cuando cambian caja, renta, condición o tick.
   */
  private syncGameplayVisual(): void {
    const projection = this.projection;
    if (!projection) return;
    const model = buildGameplayVisualModel(projection);
    if (model.geometryKey === this.gameplayGroundKey) return;
    this.gameplayGroundKey = model.geometryKey;
    this.gameplayVisual = model;
    this.groundPlan = model.groundPlan;
    this.buildingArchetypes = new Map(model.buildings.map((entry) => [entry.id, entry.archetype]));
    this.repaintGround();
    this.groundRebakeCount += 1;
    this.renderGameplayRoadMarkings();
    if (this.assetsReady) this.renderGameplayStreetLife();
  }

  /** Coloca la decoración sin carretera (árboles) derivada del modelo visual de gameplay. */
  private renderGameplayDecorations(): void {
    for (const sprite of this.decorSprites) sprite.destroy();
    this.decorSprites = [];
    const model = this.gameplayVisual;
    if (!model || !this.assetsReady) return;
    const assets = ASSETS_BLENDER.props ?? {};
    for (const decoration of model.decorations) {
      const asset = assets[decoration.asset];
      if (!asset) continue;
      const key = `blender-sprite-${decoration.asset}`;
      if (!this.textures.exists(key)) continue;
      const frame = this.sceneryFrame(asset, undefined);
      const center = gridToScreen(footprintCenter(decoration.cell, asset.footprint), this.layout);
      const image = this.add
        .image(center.x, center.y, key)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setScale(spriteScaleFor(asset, this.layout.tileWidth) * decoration.scale)
        .setDepth(depthForAsset(decoration.cell, asset.footprint));
      image.setVisible(this.isInViewport(center.x, center.y, this.cameras.main.worldView, 96));
      this.decorSprites.push(image);
    }
  }

  private renderGameplayStreetLife(): void {
    this.renderGameplayDecorations();
    const model = this.gameplayVisual;
    if (!model || !this.assetsReady) return;
    const props = ASSETS_BLENDER.props ?? {};
    const seenFurniture = new Set<string>();
    for (const furniture of model.streetFurniture) {
      const asset = props[furniture.asset];
      if (!asset) continue;
      const frame = this.sceneryFrame(asset, furniture.azimuth);
      const center = gridToScreen(furniture.cell, this.layout);
      const offset = furniture.curbEdge
        ? this.screenOffsetTowardRoad(furniture.curbEdge, 0.28)
        : { x: 0, y: 0 };
      const key = `blender-sprite-${furniture.asset}${frame.keySuffix}`;
      if (!this.textures.exists(key)) continue;
      const image =
        this.streetFurnitureSprites.get(furniture.id) ??
        this.add.image(center.x + offset.x, center.y + offset.y, key);
      this.streetFurnitureSprites.set(furniture.id, image);
      image
        .setTexture(key)
        .setPosition(center.x + offset.x, center.y + offset.y)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setScale(spriteScaleFor(frame, this.layout.tileWidth) * furniture.scale)
        .setDepth(depthForAsset(furniture.cell, asset.footprint));
      image.setVisible(this.isInViewport(image.x, image.y, this.cameras.main.worldView, 96));
      seenFurniture.add(furniture.id);
    }
    for (const [id, sprite] of this.streetFurnitureSprites) {
      if (seenFurniture.has(id)) continue;
      sprite.destroy();
      this.streetFurnitureSprites.delete(id);
    }
    const seenPublicSpaceFurniture = new Set<string>();
    for (const furniture of model.publicSpaceFurniture ?? []) {
      const asset = props[furniture.asset];
      if (!asset) continue;
      const frame = this.sceneryFrame(asset, furniture.azimuth);
      const center = gridToScreen(furniture.cell, this.layout);
      const key = `blender-sprite-${furniture.asset}${frame.keySuffix}`;
      if (!this.textures.exists(key)) continue;
      const image =
        this.publicSpaceFurnitureSprites.get(furniture.id) ??
        this.add.image(center.x, center.y, key);
      this.publicSpaceFurnitureSprites.set(furniture.id, image);
      image
        .setTexture(key)
        .setPosition(center.x, center.y)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setScale(spriteScaleFor(frame, this.layout.tileWidth) * furniture.scale)
        .setDepth(depthForAsset(furniture.cell, asset.footprint));
      image.setVisible(this.isInViewport(image.x, image.y, this.cameras.main.worldView, 96));
      seenPublicSpaceFurniture.add(furniture.id);
    }
    for (const [id, sprite] of this.publicSpaceFurnitureSprites) {
      if (seenPublicSpaceFurniture.has(id)) continue;
      sprite.destroy();
      this.publicSpaceFurnitureSprites.delete(id);
    }
    const seenParcelDressing = new Set<string>();
    for (const dressing of model.parcelDressing ?? []) {
      const asset = props[dressing.asset];
      if (!asset) continue;
      const frame = this.sceneryFrame(asset, 45);
      const center = gridToScreen(dressing.cell, this.layout);
      const key = `blender-sprite-${dressing.asset}${frame.keySuffix}`;
      if (!this.textures.exists(key)) continue;
      const image =
        this.parcelDressingSprites.get(dressing.id) ?? this.add.image(center.x, center.y, key);
      this.parcelDressingSprites.set(dressing.id, image);
      image
        .setTexture(key)
        .setPosition(center.x, center.y)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setScale(spriteScaleFor(frame, this.layout.tileWidth) * dressing.scale)
        .setDepth(depthForAsset(dressing.cell, asset.footprint));
      image.setVisible(this.isInViewport(image.x, image.y, this.cameras.main.worldView, 96));
      seenParcelDressing.add(dressing.id);
    }
    for (const [id, sprite] of this.parcelDressingSprites) {
      if (seenParcelDressing.has(id)) continue;
      sprite.destroy();
      this.parcelDressingSprites.delete(id);
    }
    const vehicles = ASSETS_BLENDER.vehicles ?? {};
    const seenVehicles = new Set<string>();
    for (const vehicle of [...model.parkedVehicles, ...(model.contextVehicles ?? [])]) {
      const asset = vehicles[vehicle.asset];
      if (!asset) continue;
      const frame = this.sceneryFrame(asset, vehicle.azimuth);
      const key = `blender-sprite-${vehicle.asset}${frame.keySuffix}`;
      if (!this.textures.exists(key)) continue;
      const center = gridToScreen(footprintCenter(vehicle.roadCell, asset.footprint), this.layout);
      const offset = this.screenOffsetForVehicle(vehicle);
      const image =
        this.parkedVehicleSprites.get(vehicle.id) ??
        this.add.image(center.x + offset.x, center.y + offset.y, key);
      this.parkedVehicleSprites.set(vehicle.id, image);
      image
        .setTexture(key)
        .setPosition(center.x + offset.x, center.y + offset.y)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setScale(spriteScaleFor(frame, this.layout.tileWidth) * vehicle.scale)
        .setDepth(depthForAsset(vehicle.roadCell, asset.footprint));
      image.setVisible(this.isInViewport(image.x, image.y, this.cameras.main.worldView, 128));
      seenVehicles.add(vehicle.id);
    }
    for (const [id, sprite] of this.parkedVehicleSprites) {
      if (seenVehicles.has(id)) continue;
      sprite.destroy();
      this.parkedVehicleSprites.delete(id);
    }
    // V.h.7/V.h.11: actores ambientales + profesionales contextuales (avatares Rocketbox horneados).
    const seenActors = new Set<string>();
    for (const actor of [...(model.ambientActors ?? []), ...(model.contextActors ?? [])]) {
      const key = `blender-character-${actor.character}-${actor.animation}-d${actor.direction}-${actor.slot}`;
      if (!this.textures.exists(key)) continue;
      const renderCell =
        "curbEdge" in actor && "lateralOffset" in actor
          ? contextActorRenderCell(actor as GameplayContextActor)
          : actor.cell;
      const center = gridToScreen(renderCell, this.layout);
      const image =
        this.ambientActorSprites.get(actor.id) ?? this.add.image(center.x, center.y, key);
      this.ambientActorSprites.set(actor.id, image);
      image
        .setTexture(key)
        .setPosition(center.x, center.y)
        .setOrigin(0.5, 0.94)
        .setScale(CHARACTER_RENDER_SCALE)
        .setDepth(depthForAsset(renderCell, { width: 1, height: 1 }));
      image.setVisible(this.isInViewport(image.x, image.y, this.cameras.main.worldView, 96));
      seenActors.add(actor.id);
    }
    for (const [id, sprite] of this.ambientActorSprites) {
      if (seenActors.has(id)) continue;
      sprite.destroy();
      this.ambientActorSprites.delete(id);
    }
  }

  private screenOffsetTowardRoad(edge: "n" | "e" | "s" | "w", cells: number): ScreenPoint {
    const delta =
      edge === "n"
        ? { x: 0, y: cells }
        : edge === "e"
          ? { x: -cells, y: 0 }
          : edge === "s"
            ? { x: 0, y: -cells }
            : { x: cells, y: 0 };
    const origin = gridToScreen({ x: 0, y: 0 }, this.layout);
    const target = gridToScreen(delta, this.layout);
    return { x: target.x - origin.x, y: target.y - origin.y };
  }

  private screenOffsetForVehicle(vehicle: GameplayParkedVehicle): ScreenPoint {
    const lateral =
      vehicle.side === "n"
        ? { x: 0, y: -vehicle.lateralOffset }
        : vehicle.side === "e"
          ? { x: vehicle.lateralOffset, y: 0 }
          : vehicle.side === "s"
            ? { x: 0, y: vehicle.lateralOffset }
            : { x: -vehicle.lateralOffset, y: 0 };
    const longitudinal =
      vehicle.azimuth === 45
        ? { x: 0, y: vehicle.longitudinalOffset }
        : { x: vehicle.longitudinalOffset, y: 0 };
    const origin = gridToScreen({ x: 0, y: 0 }, this.layout);
    const target = gridToScreen(
      { x: lateral.x + longitudinal.x, y: lateral.y + longitudinal.y },
      this.layout,
    );
    return { x: target.x - origin.x, y: target.y - origin.y };
  }

  private updateGameplayStreetLifeVisibility(): void {
    if (this.sliceLayout) return;
    const view = this.cameras.main.worldView;
    for (const sprite of [
      ...this.decorSprites,
      ...this.streetFurnitureSprites.values(),
      ...this.publicSpaceFurnitureSprites.values(),
      ...this.parcelDressingSprites.values(),
      ...this.ambientActorSprites.values(),
    ]) {
      sprite.setVisible(this.isInViewport(sprite.x, sprite.y, view, 96));
    }
    for (const sprite of this.parkedVehicleSprites.values()) {
      sprite.setVisible(this.isInViewport(sprite.x, sprite.y, view, 128));
    }
    for (const entry of this.crewSprites.values()) {
      entry.image.setVisible(this.isInViewport(entry.image.x, entry.image.y, view, 96));
    }
  }

  /**
   * V.k.3 · reconcile del pool de cuadrillas. La lectura la hace `crewSpriteObservations`, la misma
   * fuente de la que sale la etiqueta de obra; aquí sólo se crean, reubican y destruyen imágenes.
   * Un sprite por agente: una cuadrilla de tres es gente distinta andando a la vez, no un círculo.
   */
  private syncCrewSprites(): void {
    const projection = this.projection;
    if (!projection?.economy || this.sliceLayout) {
      this.clearCrewSprites();
      return;
    }
    this.crewObservations = crewSpriteObservations(projection, this.crewObservations);
    if (!this.assetsReady) return;
    for (const [agentId, entry] of this.crewSprites) {
      if (this.crewObservations.has(agentId)) continue;
      entry.image.destroy();
      this.crewSprites.delete(agentId);
    }
    for (const observation of this.crewObservations.values()) {
      const target = gridToScreen(observation.renderCell, this.layout);
      const existing = this.crewSprites.get(observation.agentId);
      if (existing) {
        existing.target = target;
        existing.cell = observation.renderCell;
        continue;
      }
      const key = crewAnimationFrameKey(
        ASSETS_BLENDER,
        observation.character,
        observation.animation,
        observation.direction,
        this.time.now,
      );
      if (!this.textures.exists(key)) continue;
      const image = this.add
        .image(target.x, target.y, key)
        .setOrigin(0.5, 0.94)
        .setScale(CHARACTER_RENDER_SCALE)
        .setDepth(depthForAsset(observation.renderCell, { width: 1, height: 1 }));
      image.setVisible(this.isInViewport(target.x, target.y, this.cameras.main.worldView, 96));
      this.crewSprites.set(observation.agentId, {
        image,
        key,
        target,
        cell: observation.renderCell,
      });
    }
  }

  /** Cambiar de distrito, apagar la economía o salir del modo gameplay deja el pool vacío. */
  private clearCrewSprites(): void {
    for (const entry of this.crewSprites.values()) entry.image.destroy();
    this.crewSprites.clear();
    this.crewObservations.clear();
  }

  /**
   * Reloj de animación e interpolación entre proyecciones. La proyección llega cada 2 ticks y el
   * paso autoritativo dura `ticksPerCell`, así que el destino publicado salta: el sprite desliza
   * hacia él en lugar de teletransportarse. Ninguna de las dos cosas es estado del mundo.
   */
  private animateCrewSprites(time: number, delta: number): void {
    if (this.crewSprites.size === 0) return;
    const ease = 1 - Math.exp(-Math.max(0, delta) / CREW_INTERPOLATION_MS);
    for (const [agentId, entry] of this.crewSprites) {
      const observation = this.crewObservations.get(agentId);
      if (!observation) continue;
      const key = crewAnimationFrameKey(
        ASSETS_BLENDER,
        observation.character,
        observation.animation,
        observation.direction,
        time,
      );
      if (key !== entry.key) {
        entry.image.setTexture(key);
        entry.key = key;
      }
      entry.image.setDepth(depthForAsset(entry.cell, { width: 1, height: 1 }));
      if (entry.image.x === entry.target.x && entry.image.y === entry.target.y) continue;
      entry.image.setPosition(
        entry.image.x + (entry.target.x - entry.image.x) * ease,
        entry.image.y + (entry.target.y - entry.image.y) * ease,
      );
    }
  }

  /**
   * Renderiza pasos de peatones sólo en T y cruces publicados por la simulación. Los decals no
   * rederivan carreteras: consumen la máscara que ya calculó el adapter desde `roads.cells`.
   */
  private renderGameplayRoadMarkings(): void {
    for (const sprite of this.roadMarkingSprites) sprite.destroy();
    this.roadMarkingSprites = [];
    const markings = this.groundPlan?.roadMarkings ?? [];
    for (const marking of markings) {
      const key = `${CROSSING_TEXTURE_KEY}-${marking.mask}`;
      if (!this.textures.exists(key)) {
        const texture = this.textures.createCanvas(
          key,
          CROSSING_TEXTURE.width,
          CROSSING_TEXTURE.height,
        );
        if (texture) {
          paintCrossing(texture.context, this.layout, marking.mask);
          texture.refresh();
        }
      }
      if (!this.textures.exists(key)) continue;
      const center = this.screenCenter(marking.cell);
      this.roadMarkingSprites.push(
        this.add.image(center.x, center.y, key).setOrigin(0.5, 0.5).setDepth(ROAD_MARKING_DEPTH),
      );
    }
  }

  /**
   * Pasos de peatones sobre la calzada. Una sola textura horneada se reutiliza en cada cruce: la
   * calzada es un sprite de Blender por encima del suelo, así que su marca vial va en su propia capa.
   */
  private drawCrossings(): void {
    const plan = this.groundPlan;
    if (!plan) return;
    if (!this.textures.exists(CROSSING_TEXTURE_KEY)) {
      const texture = this.textures.createCanvas(
        CROSSING_TEXTURE_KEY,
        CROSSING_TEXTURE.width,
        CROSSING_TEXTURE.height,
      );
      if (texture) {
        paintCrossing(texture.context, this.layout);
        texture.refresh();
      }
    }
    for (const crossing of plan.crossings) {
      const center = this.screenCenter(crossing);
      const image = this.add
        .image(center.x, center.y, CROSSING_TEXTURE_KEY)
        .setOrigin(0.5, 0.5)
        .setDepth(ROAD_MARKING_DEPTH);
      this.sliceObjects.push(image);
    }
  }

  private groundBounds(): GroundBounds {
    const halfWidth = this.layout.tileWidth / 2;
    const halfHeight = this.layout.tileHeight / 2;
    return {
      x: this.layout.origin.x - (this.layout.mapHeight - 1) * halfWidth - halfWidth,
      y: this.layout.origin.y - halfHeight,
      width: (this.layout.mapWidth + this.layout.mapHeight) * halfWidth,
      height: (this.layout.mapWidth + this.layout.mapHeight) * halfHeight,
    };
  }

  private drawOverlay(): void {
    const graphics = this.mapGraphics;
    if (!graphics) return;
    graphics.clear();
    /** Vista normal: no se dibujan todas las parcelas; sólo su contexto seleccionado. */
    if (this.overlay !== "none")
      for (const parcel of this.projection?.economy?.parcels ?? [])
        this.drawParcelGeometry(parcel.cells, this.parcelOverlayColor(parcel), 0.17, 0.68, 2);
    /**
     * H2-01: el overlay es el fallback mientras los sprites no están listos, así que también debe
     * leerse por la huella física del edificio. Antes se resolvía la parcela vía
     * `parcel.buildingId === building.id`, que es sólo el primer edificio derivado, así que un
     * parcela multi-edificio ocultaba al segundo también aquí.
     */
    const buildingById = new Map<string, { footprintCells: readonly GridCell[]; level: number }>();
    for (const building of this.projection?.economy?.buildings ?? []) {
      buildingById.set(building.id, {
        footprintCells: building.footprintCells,
        level: building.level,
      });
    }
    for (const building of this.projection?.economy?.buildings ?? []) {
      if (this.assetsReady) break;
      const center = gridToScreen(footprintVisualCenter(building.footprintCells), this.layout);
      graphics.fillStyle(
        building.state === "ruin"
          ? COLORS.ruin
          : building.state === "burning" || building.state === "collapse_pending"
            ? COLORS.fire
            : COLORS.building,
        0.9,
      );
      graphics.fillRect(center.x - 7, center.y - 12, 14, 12 + building.level * 3);
    }
    this.drawPropertyGrounds(graphics);
    let constructionLabelCount = 0;
    for (const site of this.projection?.economy?.constructionSites ?? []) {
      // V.j.5: con arte real de variantes, la obra la pinta el sprite (syncBuildingSprites); el
      // massing procedural sólo sostiene los tipos sin variantes o el arranque sin texturas.
      if (this.assetsReady && hasRealVariants(site.buildingType)) continue;
      this.drawConstructionSite(graphics, site);
    }
    constructionLabelCount = this.drawCrewPresence(constructionLabelCount);
    this.trimLabels(this.constructionLabels, constructionLabelCount);
    for (const incident of this.projection?.economy?.incidents.filter(
      (entry) => entry.status === "active",
    ) ?? []) {
      const building = buildingById.get(incident.buildingId);
      if (!building) continue;
      const center = gridToScreen(footprintVisualCenter(building.footprintCells), this.layout);
      graphics.fillStyle(COLORS.fire, 0.9);
      graphics.fillCircle(center.x + 8, center.y - 14, 4 + Math.min(6, incident.intensity / 20));
    }
    const target = this.selectionTarget;
    if (target?.kind === "parcel") {
      const parcel = this.projection?.economy?.parcels.find(
        (entry) => entry.id === target.parcelId,
      );
      if (parcel) this.drawSelectedParcel(parcel);
    } else if (target?.kind === "building") {
      const building = this.projection?.economy?.buildings.find(
        (entry) => entry.id === target.buildingId,
      );
      if (building) {
        this.drawParcelContext(building.parcelIds);
        this.drawParcelGeometry(building.footprintCells, COLORS.selected, 0.16, 1, 4);
      }
    } else if (target?.kind === "construction") {
      const site = this.projection?.economy?.constructionSites.find(
        (entry) => entry.id === target.siteId,
      );
      if (site) {
        this.drawParcelContext(site.parcelIds);
        this.drawParcelGeometry(site.footprintCells, COLORS.selected, 0.16, 1, 4);
      }
    } else if (target?.kind === "facility") {
      const facility = this.projection?.facilities.find((entry) => entry.id === target.facilityId);
      const buildings = facility
        ? (this.projection?.economy?.buildings.filter((entry) =>
            facility.buildingIds.includes(entry.id),
          ) ?? [])
        : [];
      if (buildings.length > 0)
        for (const building of buildings)
          this.drawParcelGeometry(building.footprintCells, COLORS.selected, 0.16, 1, 4);
      else if (facility) this.drawParcelContext(facility.parcelIds, true);
    } else if (target?.kind === "public-space") {
      const space = this.projection?.publicSpaces.find(
        (entry) => entry.id === target.publicSpaceId,
      );
      if (space) this.drawParcelGeometry(space.cells, COLORS.selected, 0.12, 1, 3);
    } else if (target?.kind === "site-assembly") {
      for (const parcel of this.projection?.economy?.parcels.filter((entry) =>
        target.candidateParcelIds.includes(entry.id),
      ) ?? [])
        this.drawParcelGeometry(parcel.cells, COLORS.parcelPlayer, 0.05, 0.45, 2);
      for (const parcel of this.projection?.economy?.parcels.filter((entry) =>
        target.parcelIds.includes(entry.id),
      ) ?? [])
        this.drawSelectedParcel(parcel);
    } else if (this.selectedCell) {
      const parcel = this.projection?.economy?.parcels.find((entry) =>
        entry.cells.some(
          (cell) => cell.x === this.selectedCell?.x && cell.y === this.selectedCell?.y,
        ),
      );
      if (parcel) this.drawSelectedParcel(parcel);
    }
  }

  /**
   * V.d-7C · dibujo del modo. Se ven: el contexto catastral del proyecto, las candidatas legales,
   * cuál es la recomendada, cuál está seleccionada y el frente vial del solar. Todo con la capa
   * propia; el overlay normal no se toca.
   */
  /**
   * Etiqueta reutilizada del contenedor `index`, creada sólo si hace falta. Sin esto, cada repintado
   * de la colocación creaba 24 texturas nuevas y el mapa caía de 60 a ~10 FPS medidos.
   */
  private pooledLabel(
    container: Phaser.GameObjects.Container | undefined,
    index: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text | null {
    if (!container) return null;
    const existing = container.list[index] as Phaser.GameObjects.Text | undefined;
    if (existing) {
      existing.setVisible(true);
      return existing;
    }
    const created = this.add.text(0, 0, "", { resolution: 2, ...style }).setOrigin(0.5);
    created.setActive(false);
    container.add(created);
    return created;
  }

  /** Esconde las etiquetas del pool que este repintado no usó, sin destruirlas. */
  private trimLabels(container: Phaser.GameObjects.Container | undefined, used: number): void {
    if (!container) return;
    for (let index = used; index < container.list.length; index += 1)
      (container.list[index] as Phaser.GameObjects.Text).setVisible(false);
  }

  private drawPlacement(): void {
    this.placementDrawCount += 1;
    const graphics = this.placementGraphics;
    if (!graphics) return;
    graphics.clear();
    const target = this.placementTarget;
    if (!target) {
      /** Salir del modo limpia la capa entera: huérfanos no, aunque el pool siga vivo. */
      this.trimLabels(this.placementLabels, 0);
      this.placementGhost?.setVisible(false);
      return;
    }
    const parcels = (this.projection?.economy?.parcels ?? []).filter((parcel) =>
      target.parcelIds.includes(parcel.id),
    );
    for (const parcel of parcels)
      this.drawParcelGeometry(parcel.cells, PLACEMENT_COLORS.context, 0.05, 0.85, 3, graphics);
    /** Frente vial del solar: dónde toca la calle la propiedad que se va a construir. */
    graphics.lineStyle(4, PLACEMENT_COLORS.context, 0.95);
    for (const parcel of parcels)
      for (const frontage of parcel.roadFrontages)
        for (const cell of frontage.cells) {
          const center = gridToScreen(cell, this.layout);
          graphics.strokeCircle(center.x, center.y, 7);
        }
    /**
     * Todas las candidatas se ven a la vez, numeradas igual que la lista de la ficha: sin número en
     * el mapa, una lista de «4 celdas · 0° · 1 planta» repetida 24 veces no le dice a nadie DÓNDE.
     */
    let labelIndex = 0;
    target.candidates.forEach((candidate, index) => {
      const selected = candidate.id === target.selectedCandidateId;
      if (!selected)
        this.drawParcelGeometry(
          candidate.footprintCells,
          candidate.recommended ? PLACEMENT_COLORS.recommended : PLACEMENT_COLORS.candidate,
          candidate.recommended ? 0.14 : 0.08,
          candidate.recommended ? 1 : 0.7,
          candidate.recommended ? 3 : 2,
          graphics,
        );
      const anchor = candidate.footprintCells.reduce(
        (best, cell) => (cell.x + cell.y < best.x + best.y ? cell : best),
        candidate.footprintCells[0]!,
      );
      const point = gridToScreen(anchor, this.layout);
      const radius = selected ? 11 : 9;
      graphics.fillStyle(selected ? PLACEMENT_COLORS.selected : PLACEMENT_COLORS.candidate, 1);
      graphics.fillCircle(point.x, point.y - 4, radius);
      graphics.lineStyle(2, 0x0c1220, 1);
      graphics.strokeCircle(point.x, point.y - 4, radius);
      const label = this.pooledLabel(this.placementLabels, labelIndex, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#0c1220",
      });
      const wanted = String(index + 1);
      if (label && label.text !== wanted) label.setText(wanted);
      /**
       * Reescribir texto o tamaño regenera la textura del label: con 24 candidatas y una
       * proyección cada dos ticks, el mapa bajaba de 60 a ~9 FPS. Sólo se toca lo que cambió.
       */
      if (label && (label.x !== point.x || label.y !== point.y - 4))
        label.setPosition(point.x, point.y - 4);
      labelIndex += 1;
    });
    this.trimLabels(this.placementLabels, labelIndex);
    const selected = target.candidates.find(
      (candidate) => candidate.id === target.selectedCandidateId,
    );
    if (selected)
      this.drawParcelGeometry(
        selected.footprintCells,
        PLACEMENT_COLORS.selected,
        0.26,
        1,
        5,
        graphics,
      );
    this.updatePlacementGhost(selected?.footprintCells ?? null);
  }

  /**
   * V.d-7C · la obra se lee como proceso físico sobre su huella exacta: hoyo y solera, estructura a
   * medio hacer con andamio, acabados y nada cuando ya es edificio. Las bandas salen de
   * `construction-stages`, que sólo mira el progreso autoritativo.
   */
  private drawConstructionSite(
    graphics: Phaser.GameObjects.Graphics,
    site: NonNullable<ViewProjectionV2["economy"]>["constructionSites"][number],
  ): void {
    const stage = constructionVisualStage(site.progress, site.workRequired);
    if (stage === "complete") return;
    const massing = constructionStageMassing(stage);
    const halfWidth = this.layout.tileWidth / 2;
    const halfHeight = this.layout.tileHeight / 2;
    const height = (6 + site.floors * 5) * massing;
    for (const cell of site.footprintCells) {
      const center = gridToScreen(cell, this.layout);
      /** Solera / excavación: el suelo preparado, distinto del solar sin edificar. */
      graphics.fillStyle(
        stage === "foundation" ? CONSTRUCTION_COLORS.excavation : CONSTRUCTION_COLORS.pad,
        stage === "foundation" ? 0.85 : 0.5,
      );
      graphics.beginPath();
      graphics.moveTo(center.x, center.y - halfHeight);
      graphics.lineTo(center.x + halfWidth, center.y);
      graphics.lineTo(center.x, center.y + halfHeight);
      graphics.lineTo(center.x - halfWidth, center.y);
      graphics.closePath();
      graphics.fillPath();
      /** Volumen parcial: crece con la etapa, nunca es el sprite final con alpha. */
      graphics.fillStyle(CONSTRUCTION_COLORS.massing, stage === "finishing" ? 0.95 : 0.72);
      graphics.fillRect(center.x - halfWidth * 0.55, center.y - height, halfWidth * 1.1, height);
      graphics.lineStyle(1, CONSTRUCTION_COLORS.scaffold, 0.9);
      graphics.strokeRect(center.x - halfWidth * 0.55, center.y - height, halfWidth * 1.1, height);
    }
    if (stage === "structure" || stage === "finishing") {
      /** Andamio original: retícula fina sobre el volumen, sin copiar ningún cursor histórico. */
      const bounds = site.footprintCells.reduce(
        (box, cell) => {
          const point = gridToScreen(cell, this.layout);
          return {
            left: Math.min(box.left, point.x - halfWidth),
            right: Math.max(box.right, point.x + halfWidth),
            top: Math.min(box.top, point.y - height),
            bottom: Math.max(box.bottom, point.y + halfHeight),
          };
        },
        {
          left: Number.POSITIVE_INFINITY,
          right: Number.NEGATIVE_INFINITY,
          top: Number.POSITIVE_INFINITY,
          bottom: Number.NEGATIVE_INFINITY,
        },
      );
      graphics.lineStyle(1, CONSTRUCTION_COLORS.scaffold, 0.55);
      for (let x = bounds.left; x <= bounds.right; x += 9)
        graphics.lineBetween(x, bounds.top, x, bounds.bottom);
      for (let y = bounds.top; y <= bounds.bottom; y += 9)
        graphics.lineBetween(bounds.left, y, bounds.right, y);
    }
    const center = gridToScreen(footprintVisualCenter(site.footprintCells), this.layout);
    const ratio =
      site.workRequired > 0 ? Math.min(1, Math.max(0, site.progress / site.workRequired)) : 1;
    graphics.fillStyle(0x0c1220, 0.75);
    graphics.fillRect(center.x - 11, center.y - height - 12, 22, 4);
    graphics.fillStyle(COLORS.construction, 1);
    graphics.fillRect(center.x - 11, center.y - height - 12, 22 * ratio, 4);
  }

  /**
   * V.d-7C · la propiedad como recinto. El entorno se deriva de geometría autoritativa y tipo, se
   * cachea por firma y se dibuja con formas distintas por descriptor. No es gameplay: no cambia
   * propiedad, colisión, producción, valoración, cobertura ni FAR (D-097 · Site grounds).
   */
  private drawPropertyGrounds(graphics: Phaser.GameObjects.Graphics): void {
    const economy = this.projection?.economy;
    if (!economy) {
      this.groundsByProperty.clear();
      return;
    }
    const parcelsById = new Map(economy.parcels.map((parcel) => [parcel.id, parcel]));
    const halfWidth = this.layout.tileWidth / 2;
    const halfHeight = this.layout.tileHeight / 2;
    const seen = new Set<string>();
    for (const building of economy.buildings) {
      const parcels = building.parcelIds
        .map((id) => parcelsById.get(id))
        .filter((parcel): parcel is NonNullable<typeof parcel> => Boolean(parcel));
      if (parcels.length === 0) continue;
      const siteCells = parcels.flatMap((parcel) => parcel.cells);
      const frontageCells = parcels.flatMap((parcel) =>
        parcel.roadFrontages.flatMap((frontage) => frontage.cells),
      );
      const cacheKey = propertyGroundsCacheKey({
        buildingId: building.id,
        siteCells,
        footprintCells: building.footprintCells,
        frontageCells,
      });
      seen.add(cacheKey);
      let descriptors = this.groundsByProperty.get(cacheKey);
      if (!descriptors) {
        const family: GroundFamily = parcels.some((parcel) => parcel.disposition === "public")
          ? "civic"
          : parcels[0]!.zoning;
        descriptors = planPropertyGrounds({
          buildingType: building.type,
          family,
          siteCells,
          footprintCells: building.footprintCells,
          frontageCells,
        });
        this.groundsByProperty.set(cacheKey, descriptors);
      }
      for (const descriptor of descriptors) {
        const center = gridToScreen(descriptor.cell, this.layout);
        const color = GROUND_COLORS[descriptor.kind] ?? 0x69a86b;
        if (descriptor.kind === "hedge" || descriptor.kind === "fence") {
          graphics.lineStyle(3, color, 0.9);
          graphics.lineBetween(
            center.x - halfWidth * 0.7,
            center.y,
            center.x + halfWidth * 0.7,
            center.y,
          );
          continue;
        }
        if (descriptor.kind === "tree") {
          graphics.fillStyle(color, 0.9);
          graphics.fillCircle(center.x, center.y - 4, 4);
          continue;
        }
        if (descriptor.kind === "pallets" || descriptor.kind === "containers") {
          graphics.fillStyle(color, 0.85);
          graphics.fillRect(center.x - 5, center.y - 3, 10, 6);
          continue;
        }
        if (descriptor.kind === "loading-area") {
          graphics.lineStyle(2, color, 0.9);
          graphics.strokeRect(
            center.x - halfWidth * 0.5,
            center.y - halfHeight * 0.5,
            halfWidth,
            halfHeight,
          );
          continue;
        }
        const alpha =
          descriptor.kind === "path" || descriptor.kind === "hardstanding" ? 0.45 : 0.22;
        graphics.fillStyle(color, alpha);
        graphics.beginPath();
        graphics.moveTo(center.x, center.y - halfHeight);
        graphics.lineTo(center.x + halfWidth, center.y);
        graphics.lineTo(center.x, center.y + halfHeight);
        graphics.lineTo(center.x - halfWidth, center.y);
        graphics.closePath();
        graphics.fillPath();
      }
    }
    /** La caché no puede crecer con propiedades que ya no están en la vista. */
    for (const key of [...this.groundsByProperty.keys()])
      if (!seen.has(key)) this.groundsByProperty.delete(key);
  }

  /**
   * V.d-7C · cuadrillas ligadas al solar. Se lee únicamente información ya autoritativa y
   * proyectada: a qué obra está asignada cada cuadrilla, en qué celda está cada agente y en qué
   * estado está. No hay un segundo sistema de movimiento.
   *
   * V.k.3 · los anillos se fueron: la gente ya se ve como sprites andando, así que sobre la obra
   * sólo cuelga la cuenta de quién está dentro, contada sobre las mismas observaciones que pintó la
   * escena. Escena y etiqueta no pueden discrepar.
   */
  private drawCrewPresence(labelIndex: number): number {
    const economy = this.projection?.economy;
    if (!economy) return labelIndex;
    const sites = economy.constructionSites.filter((site) => site.assignedCrewIds.length > 0);
    if (sites.length === 0) return labelIndex;
    for (const site of sites) {
      let present = 0;
      for (const observation of this.crewObservations.values()) {
        if (observation.siteId !== site.id) continue;
        if (observation.visualState === "on-site" || observation.visualState === "working")
          present += 1;
      }
      const center = gridToScreen(footprintVisualCenter(site.footprintCells), this.layout);
      const label = this.pooledLabel(this.constructionLabels, labelIndex, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "11px",
        color: "#e8edf5",
        backgroundColor: "#0c1220cc",
        padding: { x: 4, y: 2 },
      });
      const wanted = present > 0 ? `${present} en obra` : "cuadrilla de camino";
      if (label && label.text !== wanted) label.setText(wanted);
      if (label && (label.x !== center.x || label.y !== center.y - 34))
        label.setPosition(center.x, center.y - 34);
      labelIndex += 1;
    }
    return labelIndex;
  }

  /**
   * El fantasma usa el asset runtime real del tipo con alpha < 1 (D-097 · Ghost), con el mismo
   * pivote y escala que un edificio terminado: así la silueta coincide con lo que se va a construir.
   * Si el tipo aún no tiene textura, la huella dibujada sigue siendo la representación honesta.
   */
  private updatePlacementGhost(cells: readonly GridCell[] | null): void {
    const target = this.placementTarget;
    if (!cells || !target || !this.assetsReady) {
      this.placementGhost?.setVisible(false);
      return;
    }
    const resolved = this.resolveBuildingVisual(
      target.buildingType,
      target.buildingType,
      "complete",
    );
    if (!resolved) {
      this.placementGhost?.setVisible(false);
      return;
    }
    const center = gridToScreen(footprintVisualCenter(cells), this.layout);
    const origin = originFromPivot(resolved.asset);
    const ghost =
      this.placementGhost ??
      (this.placementGhost = this.add
        .image(center.x, center.y, resolved.key)
        .setDepth(PLACEMENT_GHOST_DEPTH)
        .setActive(false));
    if (ghost.texture.key !== resolved.key) ghost.setTexture(resolved.key);
    ghost.setPosition(center.x, center.y);
    ghost.setOrigin(origin.x, origin.y);
    ghost.setScale(spriteScaleFor(resolved.asset, this.layout.tileWidth));
    ghost.setAlpha(PLACEMENT_GHOST_ALPHA);
    ghost.setDepth(PLACEMENT_GHOST_DEPTH);
    ghost.setVisible(true);
  }

  private drawSelectedParcel(
    parcel: NonNullable<ViewProjectionV2["economy"]>["parcels"][number],
  ): void {
    const graphics = this.mapGraphics;
    if (!graphics) return;
    this.drawParcelGeometry(parcel.cells, COLORS.selected, 0.08, 1, 3);
    // El frente es un borde hacia la calle, no una colección de nodos GIS. Dibujar los segmentos
    // exteriores comunica la relación parcelaria sin falsear la geometría de las celdas.
    const frontageCells = parcel.roadFrontages.flatMap((frontage) => frontage.cells);
    const frontageKeys = new Set(frontageCells.map((cell) => `${cell.x}:${cell.y}`));
    graphics.lineStyle(6, COLORS.selected, 1);
    for (const edge of parcelBoundaryEdges(parcel.cells)) {
      const neighbour = {
        x: edge.cell.x + (edge.side === "e" ? 1 : edge.side === "w" ? -1 : 0),
        y: edge.cell.y + (edge.side === "s" ? 1 : edge.side === "n" ? -1 : 0),
      };
      if (!frontageKeys.has(`${neighbour.x}:${neighbour.y}`)) continue;
      const line = gridEdgeToScreenLine(edge, this.layout);
      graphics.lineBetween(line.from.x, line.from.y, line.to.x, line.to.y);
    }
  }

  /** Contexto catastral secundario para obras/edificios que ocupan varios solares. */
  private drawParcelContext(parcelIds: readonly string[], selected = false): void {
    for (const parcel of this.projection?.economy?.parcels.filter((entry) =>
      parcelIds.includes(entry.id),
    ) ?? [])
      this.drawParcelGeometry(
        parcel.cells,
        COLORS.selected,
        selected ? 0.06 : 0,
        selected ? 0.8 : 0.55,
        2,
      );
  }

  private drawParcelGeometry(
    cells: readonly GridCell[],
    color: number,
    fillAlpha: number,
    lineAlpha: number,
    lineWidth: number,
    graphics = this.mapGraphics,
  ): void {
    if (!graphics) return;
    const halfWidth = this.layout.tileWidth / 2;
    const halfHeight = this.layout.tileHeight / 2;
    graphics.fillStyle(color, fillAlpha);
    for (const cell of cells) {
      const center = gridToScreen(cell, this.layout);
      graphics.beginPath();
      graphics.moveTo(center.x, center.y - halfHeight);
      graphics.lineTo(center.x + halfWidth, center.y);
      graphics.lineTo(center.x, center.y + halfHeight);
      graphics.lineTo(center.x - halfWidth, center.y);
      graphics.closePath();
      graphics.fillPath();
    }
    graphics.lineStyle(lineWidth, color, lineAlpha);
    for (const edge of parcelBoundaryEdges(cells)) {
      const line = gridEdgeToScreenLine(edge, this.layout);
      graphics.lineBetween(line.from.x, line.from.y, line.to.x, line.to.y);
    }
  }

  private parcelOverlayColor(
    parcel: NonNullable<ViewProjectionV2["economy"]>["parcels"][number],
  ): number {
    /**
     * H2-01: en una parcela multi-edificio el overlay debe enseñar el peor caso, no el primero.
     * `parcel.buildingId` sólo publica el primer edificio derivado; usarlo para colorear hacía que
     * un edificio en ruinas pasara desapercibido si otro edificio de la parcela estaba intacto.
     */
    const buildingsOfParcel = (this.projection?.economy?.buildings ?? []).filter((entry) =>
      entry.parcelIds.includes(parcel.id),
    );
    if (this.overlay === "condition") {
      if (buildingsOfParcel.length === 0) return COLORS.parcelAvailable;
      const worst = Math.min(...buildingsOfParcel.map((entry) => entry.condition));
      if (worst <= 35) return COLORS.fire;
      if (worst <= 70) return COLORS.construction;
      return COLORS.parcelPlayer;
    }
    if (this.overlay === "profitability") {
      if (buildingsOfParcel.length === 0) return COLORS.parcelAvailable;
      /**
       * Rentabilidad agregada: la suma de rentas menos la suma de deudas. Si la parcela en conjunto
       * pierde, el rojo manda; si gana menos del doble, ámbar; si dobla la deuda, verde. Es la misma
       * banda que antes aplicada al primer edificio, pero ahora es la de la parcela.
       */
      const rent = buildingsOfParcel.reduce((total, entry) => total + entry.effectiveRent, 0);
      const due = buildingsOfParcel.reduce((total, entry) => total + entry.maintenanceDue, 0);
      if (rent <= due) return COLORS.fire;
      if (rent < due * 2) return COLORS.construction;
      return COLORS.parcelPlayer;
    }
    if (this.overlay === "zoning") return ZONING_COLORS[parcel.zoning];
    if (this.overlay === "risk") {
      if (parcel.regulatoryRiskPercent >= 30) return COLORS.fire;
      if (parcel.regulatoryRiskPercent >= 15) return COLORS.construction;
      return COLORS.parcelPlayer;
    }
    if (this.overlay === "landValue") {
      const score = parcel.landValueBreakdown.score;
      if (score >= 25) return COLORS.parcelPlayer;
      if (score >= 5) return COLORS.construction;
      if (score >= -10) return COLORS.parcelAvailable;
      return COLORS.fire;
    }
    if (this.overlay === "urbanRole") {
      const colors: Record<string, number> = ROLE_COLORS;
      return colors[parcel.urbanRole] ?? COLORS.parcelAvailable;
    }
    if (this.overlay === "developmentCode") {
      let hash = 0;
      for (let index = 0; index < parcel.developmentCodeId.length; index += 1) {
        hash = (hash * 31 + parcel.developmentCodeId.charCodeAt(index)) >>> 0;
      }
      return CODE_PALETTE[hash % CODE_PALETTE.length]!;
    }
    if (this.overlay === "use") {
      const use = parcel.currentUses[0] ?? parcel.allowedUses[0] ?? "residential";
      const colors: Record<string, number> = USE_COLORS;
      return colors[use] ?? COLORS.parcelAvailable;
    }
    if (
      this.overlay === "security" ||
      this.overlay === "fire" ||
      this.overlay === "health" ||
      this.overlay === "education" ||
      this.overlay === "transport"
    ) {
      /**
       * V.d-UX · un solar vacío no consume capacidad (H2-05), así que su cobertura activa es 0 y
       * pintarlo «sin cobertura» era alarmante y falso para el jugador: lo que necesita saber es
       * si el servicio LLEGARÍA al construir. Se usa la cobertura potencial de H2-10 cuando
       * existe; `transport` no tiene potencial porque es accesibilidad, no capacidad.
       */
      const vacant = buildingsOfParcel.length === 0;
      const potential =
        this.overlay === "transport" ? undefined : parcel.potentialService?.[this.overlay];
      const coverage =
        vacant && potential !== undefined
          ? potential
          : (parcel.serviceCoverage?.[this.overlay] ?? 0);
      if (coverage >= 75) return COLORS.parcelPlayer;
      if (coverage >= 40) return COLORS.construction;
      if (coverage > 0) return COLORS.parcelAvailable;
      return COLORS.fire;
    }
    return parcel.ownerOrganizationId === "org_00000001"
      ? COLORS.parcelPlayer
      : parcel.ownerOrganizationId === "org_00000002"
        ? COLORS.parcelRival
        : parcel.ownerOrganizationId === "org_00000004"
          ? COLORS.parcelCivic
          : COLORS.parcelAvailable;
  }

  private createMarkerTexture(key: string, width: number, height: number, color: string): void {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) return;
    texture.context.fillStyle = color;
    texture.context.fillRect(0, 0, width, height);
    texture.refresh();
  }

  /**
   * Compila las imágenes del manifiesto en texturas de Phaser. El contrato viaja como SVG en data
   * URI; el navegador lo rasteriza al cargar. Si una textura falla, se conserva el rectángulo de
   * respaldo en vez de romper la escena.
   */
  private async registerBuildingTextures(): Promise<void> {
    await this.registerTexturesFromBundle(ASSETS, "");
    await this.registerTexturesFromBundle(ASSETS_BLENDER, "blender-");
    if (this.sliceCharacters) await this.registerSliceCharacterTextures();
    /** En una escena apagada no hay display list que repintar: sería el siguiente error. */
    if (this.sceneDestroyed) return;
    this.assetsReady = true;
    this.syncBuildingSprites();
    this.drawOverlay();
    /** El fantasma necesita texturas: sin `assetsReady` sólo se ve la huella proxy. */
    if (this.placementTarget) this.drawPlacement();
    if (this.sliceLayout) this.renderVisualSlice();
    else {
      this.renderGameplayStreetLife();
      /** Hasta aquí las cuadrillas sólo tenían observaciones: los sprites piden texturas ya de alta. */
      this.syncCrewSprites();
    }
  }

  private async registerTexturesFromBundle(
    manifest: RuntimeAssetManifestV2,
    keyPrefix: string,
  ): Promise<void> {
    for (const [type, asset] of Object.entries(manifest.buildings)) {
      for (const [state, image] of Object.entries(asset.states)) {
        const key = `${keyPrefix}${spriteKeyFor(type, state as BuildingAssetState)}`;
        await this.registerImageTexture(key, image.src, image.width, image.height);
      }
    }
    for (const group of ["terrain", "props", "vehicles"] as const) {
      for (const [id, asset] of Object.entries(manifest[group] ?? {})) {
        const key = `${keyPrefix}sprite-${id}`;
        await this.registerImageTexture(
          key,
          asset.image.src,
          asset.image.width,
          asset.image.height,
        );
        for (const [azimuth, frame] of Object.entries(asset.orientations ?? {})) {
          await this.registerImageTexture(
            `${key}-az${azimuth}`,
            frame.image.src,
            frame.image.width,
            frame.image.height,
          );
        }
      }
    }
    // Personajes horneados (V.h.7): el array de frames viene como direction*framesPerDir+slot.
    // Se aclaran al rasterizar (V.k.3): el bake es más oscuro que el suelo que pisa.
    for (const [id, character] of Object.entries(manifest.characters ?? {})) {
      for (const [animation, anim] of Object.entries(character.animations)) {
        const framesPerDirection = Math.max(
          1,
          Math.round(anim.frames.length / character.directions),
        );
        for (let i = 0; i < anim.frames.length; i += 1) {
          const direction = Math.floor(i / framesPerDirection);
          const slot = i % framesPerDirection;
          const image = anim.frames[i];
          if (!image) continue;
          await this.registerImageTexture(
            `${keyPrefix}character-${id}-${animation}-d${direction}-${slot}`,
            image.src,
            image.width,
            image.height,
            CHARACTER_LIFT_LUT,
          );
        }
      }
    }
  }

  /** Rasteriza un src (data URI o ruta) en una textura de Phaser; un fallo no bloquea al resto. */
  private async registerImageTexture(
    key: string,
    src: string,
    width: number,
    height: number,
    lift?: Uint8Array,
  ): Promise<void> {
    if (this.sceneDestroyed || this.textures.exists(key)) return;
    const element = new Image();
    element.src = src;
    try {
      await element.decode();
    } catch {
      return;
    }
    if (!element.complete || element.naturalWidth === 0) return;
    /** El `await` de arriba es justo la ventana en la que React puede haber apagado la escena. */
    if (this.sceneDestroyed) return;
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) return;
    texture.context.drawImage(element, 0, 0, width, height);
    if (lift) {
      const frame = texture.context.getImageData(0, 0, width, height);
      const pixels = frame.data;
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = lift[pixels[i]!]!;
        pixels[i + 1] = lift[pixels[i + 1]!]!;
        pixels[i + 2] = lift[pixels[i + 2]!]!;
      }
      texture.context.putImageData(frame, 0, 0);
    }
    texture.refresh();
  }

  private async registerSliceCharacterTextures(): Promise<void> {
    for (const [id, character] of Object.entries(ASSETS.characters)) {
      for (const animation of ["idle", "walk"] as const) {
        for (const [index, frame] of character.animations[animation].frames.entries()) {
          await this.registerImageTexture(
            `character-${id}-${animation}-${index}`,
            frame.src,
            frame.width,
            frame.height,
          );
        }
      }
    }
  }

  /** Capa de presentación del Visual Slice: suelo, edificios, props, vehículos y personajes. */
  private renderVisualSlice(): void {
    const slice = this.sliceLayout;
    if (!slice || !this.assetsReady) return;
    for (const tile of slice.terrain) {
      const key = `blender-sprite-${tile.asset}`;
      const asset = ASSETS_BLENDER.terrain?.[tile.asset];
      if (!asset || !this.textures.exists(key)) continue;
      const center = this.screenCenter(tile.cell);
      const image = this.add
        .image(center.x, center.y, key)
        .setOrigin(asset.pivot.x, asset.pivot.y)
        .setScale(spriteScaleFor(asset, this.layout.tileWidth) * (tile.scale ?? 1))
        .setFlipX(tile.flipX ?? false)
        .setDepth(TERRAIN_DEPTH + tile.cell.x + tile.cell.y);
      this.sliceObjects.push(image);
    }
    const blenderKeys = new Set(this.textures.getTextureKeys());
    for (const building of slice.buildings) {
      const asset = assetFor(ASSETS_BLENDER, building.type) ?? assetFor(ASSETS, building.type);
      const proceduralKey = spriteKeyFor(building.type, building.state ?? "complete");
      const key = selectBuildingTextureKey(proceduralKey, blenderKeys);
      if (!asset || !this.textures.exists(key)) continue;
      const center = gridToScreen(footprintCenter(building.cell, asset.footprint), this.layout);
      const image = this.add
        .image(center.x, center.y, key)
        .setOrigin(asset.pivot.x, asset.pivot.y)
        .setScale(spriteScaleFor(asset, this.layout.tileWidth) * SLICE_BUILDING_SCALE)
        .setFlipX(building.flipX ?? false)
        .setDepth(depthForAsset(building.cell, asset.footprint));
      this.sliceObjects.push(image);
    }
    // Quaternius A/B test: load evidence PNG if ?quaternius=1
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("quaternius") === "1") {
      const quaterniusKey = "qa-quaternius-evidence";
      if (!this.textures.exists(quaterniusKey)) {
        const img = new Image();
        img.src = "/assets/runtime-evidence/bld_downtown-complete.png";
        img.onload = () => {
          this.textures.addImage(quaterniusKey, img);
        };
      }
      if (this.textures.exists(quaterniusKey)) {
        const quaterniusCell = { x: 32, y: 24 };
        const quaterniusFootprint = { width: 4, height: 4 };
        const center = gridToScreen(
          footprintCenter(quaterniusCell, quaterniusFootprint),
          this.layout,
        );
        const image = this.add
          .image(center.x, center.y, quaterniusKey)
          .setOrigin(0.6456, 0.8479) // pivot from evidence metadata
          .setScale(SLICE_BUILDING_SCALE)
          .setDepth(depthForAsset(quaterniusCell, quaterniusFootprint));
        this.sliceObjects.push(image);
      }
    }
    for (const [group, placements] of [
      ["props", slice.props],
      ["vehicles", slice.vehicles],
    ] as const) {
      const assets = ASSETS_BLENDER[group] ?? {};
      for (const placement of placements) {
        const asset = assets[placement.asset];
        if (!asset) continue;
        const frame = this.sceneryFrame(asset, placement.azimuth);
        const key = `blender-sprite-${placement.asset}${frame.keySuffix}`;
        if (!this.textures.exists(key)) continue;
        const center = gridToScreen(footprintCenter(placement.cell, asset.footprint), this.layout);
        const offset = "offset" in placement ? placement.offset : undefined;
        const depth = depthForAsset(placement.cell, asset.footprint);
        const image = this.add
          .image(center.x + (offset?.x ?? 0), center.y + (offset?.y ?? 0), key)
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setScale(
            spriteScaleFor(frame, this.layout.tileWidth) *
              ("scale" in placement ? (placement.scale ?? 1) : 1),
          )
          .setFlipX(placement.flipX ?? false)
          .setDepth(depth);
        this.sliceObjects.push(image);
      }
    }
    if (slice.lots?.length) this.drawSliceLots(slice.lots);
    if (this.sliceCharacters) {
      for (const character of slice.characters) {
        const asset = ASSETS.characters["vecino_variante"];
        const key = `character-vecino_variante-idle-${character.direction * 2}`;
        if (!asset || !this.textures.exists(key)) continue;
        const center = this.screenCenter(character.cell);
        const image = this.add
          .image(center.x, center.y, key)
          .setOrigin(0.5, 0.94)
          .setScale(0.7)
          .setDepth(depthForAsset(character.cell, { width: 1, height: 1 }));
        this.sliceObjects.push(image);
        this.addSliceShadow(image, center.x, center.y, image.depth);
      }
    }
    window.__visualSliceReady = true;
    window.__visualSliceObjects = this.sliceObjects.length;
    window.__visualSlicePerformance = {
      currentFps: 0,
      samples: [],
      objectCount: this.sliceObjects.length,
    };
  }

  /** Frame por defecto o variante de orientación de un asset escénico. */
  private sceneryFrame(
    asset: SceneryAssetV1,
    azimuth: number | undefined,
  ): { keySuffix: string; pivot: { x: number; y: number }; pixelsPerMeter: number | undefined } {
    const frame = azimuth === undefined ? undefined : asset.orientations?.[String(azimuth)];
    return frame
      ? { keySuffix: `-az${azimuth}`, pivot: frame.pivot, pixelsPerMeter: frame.pixelsPerMeter }
      : { keySuffix: "", pivot: asset.pivot, pixelsPerMeter: asset.pixelsPerMeter };
  }

  /** Contorno discontinuo de parcela en obra: lenguaje visual del juego, sólo presentación. */
  private drawSliceLots(lots: SliceLot[]): void {
    const graphics = this.add.graphics().setDepth(CONSTRUCTION_SITE_DEPTH);
    const halfWidth = this.layout.tileWidth / 2;
    const halfHeight = this.layout.tileHeight / 2;
    for (const lot of lots) {
      const northWest = gridToScreen(lot.from, this.layout);
      const northEast = gridToScreen({ x: lot.to.x, y: lot.from.y }, this.layout);
      const southEast = gridToScreen(lot.to, this.layout);
      const southWest = gridToScreen({ x: lot.from.x, y: lot.to.y }, this.layout);
      const corners = [
        { x: northWest.x, y: northWest.y - halfHeight },
        { x: northEast.x + halfWidth, y: northEast.y },
        { x: southEast.x, y: southEast.y + halfHeight },
        { x: southWest.x - halfWidth, y: southWest.y },
      ];
      graphics.lineStyle(2, COLORS.construction, 0.85);
      for (let index = 0; index < corners.length; index += 1) {
        this.drawDashedSegment(graphics, corners[index]!, corners[(index + 1) % corners.length]!);
      }
      graphics.fillStyle(COLORS.construction, 0.9);
      for (const corner of corners) graphics.fillRect(corner.x - 2, corner.y - 2, 4, 4);
    }
    this.sliceObjects.push(graphics);
  }

  private drawDashedSegment(
    graphics: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const dash = 7;
    const gap = 5;
    for (let travelled = 0; travelled < length; travelled += dash + gap) {
      const start = Math.min(1, travelled / length);
      const end = Math.min(1, (travelled + dash) / length);
      graphics.beginPath();
      graphics.moveTo(from.x + (to.x - from.x) * start, from.y + (to.y - from.y) * start);
      graphics.lineTo(from.x + (to.x - from.x) * end, from.y + (to.y - from.y) * end);
      graphics.strokePath();
    }
  }

  /**
   * Sombra de contacto para los personajes procedurales, que no pasan por el bake de Blender.
   */
  private addSliceShadow(
    image: Phaser.GameObjects.Image,
    x: number,
    y: number,
    depth: number,
  ): void {
    const key = this.ensureSliceShadowTexture();
    if (!this.textures.exists(key)) return;
    const width = Math.max(12, image.displayWidth * 0.95);
    const shadow = this.add
      .image(x - 6, y + 3, key)
      .setOrigin(0.5, 0.5)
      .setScale(width / 64, (width * 0.36) / 32)
      .setAlpha(0.55)
      .setDepth(depth - 0.5);
    this.sliceObjects.push(shadow);
  }

  private ensureSliceShadowTexture(): string {
    if (this.textures.exists(SLICE_SHADOW_TEXTURE_KEY)) return SLICE_SHADOW_TEXTURE_KEY;
    const texture = this.textures.createCanvas(SLICE_SHADOW_TEXTURE_KEY, 64, 32);
    if (!texture) return SLICE_SHADOW_TEXTURE_KEY;
    const gradient = texture.context.createRadialGradient(32, 16, 2, 32, 16, 30);
    gradient.addColorStop(0, "rgba(10, 16, 26, 0.55)");
    gradient.addColorStop(0.55, "rgba(10, 16, 26, 0.3)");
    gradient.addColorStop(1, "rgba(10, 16, 26, 0)");
    texture.context.fillStyle = gradient;
    texture.context.fillRect(0, 0, 64, 32);
    texture.refresh();
    return SLICE_SHADOW_TEXTURE_KEY;
  }

  /** Mantiene un sprite por edificio y sitio de obra, con pivote y depth derivados del manifiesto. */
  private syncBuildingSprites(): void {
    if (!this.assetsReady || !this.projection?.economy) return;
    const qa = window.__landlordQaState;
    const economy = qa
      ? applyQaStateOverride(this.projection.economy, qa)
      : this.projection.economy;
    const view = this.cameras.main.worldView;
    /**
     * H2-01: el plan de sprites es puro y se construye recorriendo `economy.buildings` y
     * `economy.constructionSites` una vez cada uno, con su `footprintCells` real. Antes el scene
     * resolvía cada edificio buscando `parcel.buildingId === building.id`, que sólo publica el
     * primer edificio derivado: una parcela con dos edificios pintaba uno. Ahora la paridad
     * "sprites == entradas proyectadas renderizables" se sostiene por construcción y se prueba
     * en `building-sprites.test.ts`.
     */
    const plan = buildingSpritePlan(economy, {
      archetypeFor: (id, domainType) => this.buildingArchetypes.get(id) ?? domainType,
      resolveVisual: (archetype, domainType, state, orientation, stage) =>
        this.resolveBuildingVisual(archetype, domainType, state, orientation, stage),
    });
    const seen = new Set<string>();
    for (const placement of plan) {
      const center = gridToScreen(footprintVisualCenter(placement.cells), this.layout);
      const sprite = this.ensureBuildingSprite(
        placement.id,
        placement.textureKey,
        placement.asset,
        { kind: placement.entityKind, id: placement.entityId },
      );
      sprite.setPosition(center.x, center.y);
      sprite.setScale(
        spriteScaleForDomainFootprint(placement.asset, placement.cells, this.layout.tileWidth),
      );
      sprite.setDepth(depthForFootprintCells(placement.cells) + placement.depthBias);
      sprite.setAlpha(placement.alpha);
      sprite.setVisible(this.isInViewport(center.x, center.y, view, 96));
      seen.add(placement.id);
    }
    for (const [id, sprite] of this.buildingSprites) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.buildingSprites.delete(id);
    }
    // V.j.6: acota la memoria de variantes; expulsa LRU lo que no está en uso ni en el distrito
    // observado y elimina esas texturas de Phaser (se recargarán bajo demanda si vuelven a hacer falta).
    const inUseVariantKeys = plan
      .filter((placement) => placement.textureKey.startsWith("blender-variant-"))
      .map((placement) => placement.textureKey);
    const evicted = this.variantCache.settle(
      this.projection?.observedDistrictId ?? "unknown",
      inUseVariantKeys,
    );
    for (const key of evicted) this.textures.remove(key);
  }

  /**
   * Prioriza el asset Blender del archetype resuelto por el adapter; si no existe, cae al procedural
   * del tipo de dominio. Un edificio nunca desaparece por falta de un Blender: el fallback sostiene
   * la cadena `simulation → projection → archetype → Blender si existe → procedural fallback`.
   *
   * H2-02 · la cadena vive en `resolveBuildingVisual` (helper puro de `building-sprites.ts`); aquí
   * sólo se inyectan los bundles registrados y el estado de `this.textures`, así que los 15 tipos
   * del catálogo se pueden probar sin levantar la escena.
   */
  private resolveBuildingVisual(
    archetype: string,
    domainType: string,
    state: BuildingAssetState,
    orientation: BuildingPhysicalOrientation = 0,
    stage: ConstructionStage | null = null,
  ): { key: string; asset: BuildingAssetV2 } | null {
    return resolveBuildingVisual(archetype, domainType, state, {
      blenderBundle: ASSETS_BLENDER,
      proceduralBundle: ASSETS,
      textureExists: (key) => this.textures.exists(key),
      azimuth: SCENE_AZIMUTH,
      orientation,
      stage,
      resolveVariant: (type, vState, vOrientation, vStage) => {
        const variant = resolveBuildingVariant(type, vState, vOrientation, vStage);
        if (!variant) return null;
        const key = variantTextureKey(type, vState, vOrientation, vStage);
        this.ensureVariantTexture(
          key,
          variant.image.src,
          decodedTextureBytes(variant.image.width, variant.image.height),
          this.projection?.observedDistrictId ?? "unknown",
        );
        return { key, asset: variantAsAsset(type, variant) };
      },
    });
  }

  /** V.j.6: carga perezosa por distrito; el arranque no carga el catálogo (D-102). */
  private ensureVariantTexture(key: string, src: string, bytes: number, districtId: string): void {
    if (this.textures.exists(key)) {
      this.variantCache.recordLoad(key, bytes, districtId);
      return;
    }
    if (this.pendingVariantTextures.has(key)) return;
    this.pendingVariantTextures.set(key, { bytes, districtId });
    this.load.image(key, src);
    if (!this.load.isLoading()) {
      this.load.once("complete", () => {
        for (const [pendingKey, meta] of [...this.pendingVariantTextures]) {
          if (this.textures.exists(pendingKey)) {
            this.variantCache.recordLoad(pendingKey, meta.bytes, meta.districtId);
            this.pendingVariantTextures.delete(pendingKey);
          }
        }
        this.syncBuildingSprites();
      });
      this.load.start();
    }
  }

  private ensureBuildingSprite(
    id: string,
    key: string,
    asset: BuildingAssetV2,
    target: { kind: "building" | "construction"; id: string },
  ): Phaser.GameObjects.Image {
    let sprite = this.buildingSprites.get(id);
    if (!sprite) {
      sprite = this.add.image(0, 0, key);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonReleased()) return;
        const picked = sprite?.getData("entityTarget") as
          { kind: "building" | "construction"; id: string } | undefined;
        if (picked) {
          this.suppressGroundPick = true;
          this.entityPickedListener?.(picked);
        }
        pointer.event.stopPropagation?.();
      });
      this.buildingSprites.set(id, sprite);
    } else if (sprite.texture.key !== key) {
      sprite.setTexture(key);
    }
    const origin = originFromPivot(asset);
    sprite.setOrigin(origin.x, origin.y);
    sprite.setData("entityTarget", target);
    return sprite;
  }

  private buildScreenCenterCache(): void {
    for (let y = 0; y < this.layout.mapHeight; y += 1) {
      for (let x = 0; x < this.layout.mapWidth; x += 1) {
        this.screenCenters[y * this.layout.mapWidth + x] = gridToScreen({ x, y }, this.layout);
      }
    }
  }

  private screenCenter(cell: GridCell): ScreenPoint {
    return this.screenCenters[cell.y * this.layout.mapWidth + cell.x]!;
  }

  private updateBlitterPositions(): void {
    const structures = this.projection?.structures ?? [];
    /**
     * V.k.1 · la proyección también publica a los agentes propios de otros distritos (el jugador
     * conoce su propio roster); `cell` es local a su distrito, así que sólo se pinta lo que está
     * físicamente en el distrito observado.
     */
    const agents = (this.projection?.agents ?? []).filter(
      (agent) => agent.districtId === this.projection?.observedDistrictId,
    );
    const view = this.cameras.main.worldView;
    if (this.structureBlitter) {
      while (this.structureBobs.length < structures.length) {
        this.structureBobs.push(this.structureBlitter.create(0, 0));
      }
      this.structureBobs.forEach((bob, index) => {
        const structure = structures[index];
        if (!structure) {
          if (bob.visible) bob.setVisible(false);
          return;
        }
        const center = this.screenCenter(structure.cell);
        if (!this.isInViewport(center.x, center.y, view, 16)) {
          if (bob.visible) bob.setVisible(false);
          return;
        }
        bob.setPosition(center.x - 8, center.y - 10);
        if (!bob.visible) bob.setVisible(true);
      });
    }
    if (this.agentBlitter) {
      while (this.agentBobs.length < agents.length)
        this.agentBobs.push(this.agentBlitter.create(0, 0));
      this.agentBobs.forEach((bob, index) => {
        const agent = agents[index];
        if (!agent) {
          if (bob.visible) bob.setVisible(false);
          return;
        }
        /**
         * V.k.3 · el cuadrado de 4 px era la única señal de un agente del roster; con la cuadrilla
         * ya horneada se clavaba sobre la persona. Cae cuando el agente tiene sprite propio, salvo
         * si está herido o muerto: el clip no puede decir eso y el jugador sí necesita saberlo.
         */
        if (this.crewSprites.has(agent.id) && !AGENT_STATE_TINTS[agent.state ?? ""]) {
          if (bob.visible) bob.setVisible(false);
          return;
        }
        const center = this.screenCenter(agent.cell);
        if (!this.isInViewport(center.x, center.y, view, 4)) {
          if (bob.visible) bob.setVisible(false);
          return;
        }
        bob.setPosition(center.x - 2, center.y - 8);
        const tint =
          AGENT_STATE_TINTS[agent.state ?? ""] ??
          (agent.specialty === "enforcer"
            ? 0xd95757
            : agent.specialty === "maintenance_technician"
              ? 0xb48ead
              : agent.organizationId === "org_00000002"
                ? 0xd97757
                : 0x8fcae7);
        bob.setTint(tint);
        if (!bob.visible) bob.setVisible(true);
      });
    }
  }

  private isInViewport(x: number, y: number, view: Phaser.Geom.Rectangle, margin: number): boolean {
    return (
      x + margin >= view.x &&
      x - margin <= view.right &&
      y + margin >= view.y &&
      y - margin <= view.bottom
    );
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) {
      this.dragStart = {
        x: pointer.x,
        y: pointer.y,
        scrollX: this.cameras.main.scrollX,
        scrollY: this.cameras.main.scrollY,
      };
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragStart || !pointer.isDown) return;
    const camera = this.cameras.main;
    const dx = (pointer.x - this.dragStart.x) / camera.zoom;
    const dy = (pointer.y - this.dragStart.y) / camera.zoom;
    camera.setScroll(this.dragStart.scrollX - dx, this.dragStart.scrollY - dy);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonReleased()) {
      this.dragStart = null;
      return;
    }
    if (this.suppressGroundPick) {
      this.suppressGroundPick = false;
      return;
    }
    const camera = this.cameras.main;
    const world = camera.getWorldPoint(pointer.x, pointer.y);
    const selected = pickGridCell(
      {
        x: world.x,
        y: world.y,
      },
      this.layout,
    );
    /**
     * V.d-7C · en modo colocación el puntero NO crea geometría: resuelve la candidata legal más
     * cercana y manda su identidad a React. La cercanía se calcula con la misma función pura que usa
     * la ficha, así que el scene no decide ninguna regla de elegibilidad.
     */
    if (selected && this.placementTarget && this.placementTarget.candidates.length > 0) {
      const candidateId = nearestCandidateToCell(this.placementTarget.candidates, selected);
      if (candidateId) {
        this.placementCandidateListener?.(candidateId);
        return;
      }
    }
    this.selectedCell = selected;
    this.drawOverlay();
    this.debugText?.setText(this.debugLabel());
    if (selected) {
      const value = { ...selected };
      this.events.emit("cell-picked", value);
      this.cellPickedListener?.(value);
    }
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ): void {
    void deltaX;
    void _gameObjects;
    const camera = this.cameras.main;
    const nextZoom = Phaser.Math.Clamp(camera.zoom - deltaY * 0.001, 0.5, 2.5);
    const before = camera.getWorldPoint(pointer.x, pointer.y);
    camera.setZoom(nextZoom);
    // `getWorldPoint` reads Phaser's camera matrix, which is refreshed during pre-render. Refresh it
    // here as well so the second sample observes the new zoom within this wheel event.
    camera.preRender();
    const after = camera.getWorldPoint(pointer.x, pointer.y);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
    // Apply bounds now; the next render must not introduce a delayed clamp/jump.
    camera.preRender();
    this.debugText?.setText(this.debugLabel());
  }

  /**
   * V.d-UX · indicadores de mundo (spec §9). Sólo asuntos espaciales y accionables, en orden de
   * prioridad: incendio/colapso > mantenimiento crítico > obra sin cuadrilla. Se reconstruyen
   * únicamente cuando cambia su firma —no hay un nodo por edificio ni un rebuild por tick— y su
   * visibilidad depende del zoom: los críticos siempre, el resto a partir de 0,7.
   */
  private syncWorldIndicators(): void {
    const economy = this.projection?.economy;
    if (!economy) {
      this.indicatorLayer?.setVisible(false);
      return;
    }
    /** La lista la decide `deriveWorldIndicators` (pura y probada); aquí sólo se pinta. */
    const indicators = deriveWorldIndicators(economy);
    const signature = indicators.map((entry) => entry.key).join("|");
    if (!this.indicatorLayer) {
      this.indicatorLayer = this.add.container(0, 0).setDepth(1_000_000);
    }
    if (signature === this.indicatorSignature) {
      this.indicatorLayer.setVisible(true);
      this.syncIndicatorVisibility();
      return;
    }
    this.indicatorSignature = signature;
    this.indicatorLayer.removeAll(true);
    this.indicatorLayer.setVisible(true);
    this.indicatorEntries = [];
    for (const entry of indicators) {
      const center = gridToScreen(entry.cell, this.layout);
      const color =
        entry.kind === "danger"
          ? COLORS.fire
          : entry.kind === "maintenance"
            ? COLORS.construction
            : COLORS.parcelAvailable;
      const graphic = this.add.graphics();
      graphic.fillStyle(color, 0.95);
      graphic.lineStyle(2, 0x0c1220, 1);
      if (entry.critical) {
        graphic.beginPath();
        graphic.moveTo(0, -11);
        graphic.lineTo(9, 0);
        graphic.lineTo(0, 11);
        graphic.lineTo(-9, 0);
        graphic.closePath();
        graphic.fillPath();
        graphic.strokePath();
      } else {
        graphic.fillCircle(0, 0, 8);
        graphic.strokeCircle(0, 0, 8);
      }
      const hit = this.add.zone(0, 0, 28, 28).setInteractive({ useHandCursor: true });
      hit.on("pointerover", () => this.showIndicatorTooltip(center, entry.label));
      hit.on("pointerout", () => this.indicatorTooltip?.setVisible(false));
      hit.on("pointerdown", () =>
        this.indicatorListener?.({
          parcelId: entry.parcelId,
          ...(entry.buildingId ? { buildingId: entry.buildingId } : {}),
        }),
      );
      const item = this.add.container(center.x, center.y, [graphic, hit]);
      this.indicatorLayer.add(item);
      this.indicatorEntries.push({ object: item, critical: entry.critical });
    }
    this.lastIndicatorZoom = this.cameras.main.zoom;
    this.syncIndicatorVisibility();
  }

  private syncIndicatorVisibility(): void {
    const showSecondary = this.lastIndicatorZoom >= 0.7;
    for (const entry of this.indicatorEntries)
      entry.object.setVisible(entry.critical || showSecondary);
  }

  private showIndicatorTooltip(center: { x: number; y: number }, label: string): void {
    if (!this.indicatorLayer) return;
    if (!this.indicatorTooltip) {
      this.indicatorTooltip = this.add
        .text(0, 0, "", {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "12px",
          color: "#f7f1df",
          backgroundColor: "#0c1220",
          padding: { x: 6, y: 4 },
        })
        .setDepth(1);
      this.indicatorLayer.add(this.indicatorTooltip);
    }
    this.indicatorTooltip
      .setText(label)
      .setPosition(center.x + 12, center.y - 30)
      .setVisible(true);
  }

  /**
   * Hook observacional para la regresión Playwright de cámara. Sólo existe con `?cameraTest=1` y no
   * participa en input, reglas ni estado autoritativo: los eventos siguen atravesando Phaser.
   */
  private installCameraTestHook(): void {
    if (new URLSearchParams(window.location.search).get("cameraTest") !== "1") return;
    const camera = this.cameras.main;
    const api: CameraTestApi = {
      configure: (next) => {
        camera.setZoom(next.zoom);
        camera.setScroll(next.scrollX, next.scrollY);
        camera.preRender();
      },
      getCamera: () => ({
        zoom: camera.zoom,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
      }),
      getCellScreenPoint: (cell) => {
        camera.preRender();
        const world = gridToScreen(cell, this.layout);
        const screen = camera.matrixCombined.transformPoint(world.x, world.y);
        return { x: screen.x, y: screen.y };
      },
      getEntityScreenPoint: (id) => {
        const sprite =
          this.buildingSprites.get(id) ??
          this.buildingSprites.get(`building:${id}`) ??
          this.buildingSprites.get(`site:${id}`);
        if (!sprite) return null;
        camera.preRender();
        const screen = camera.matrixCombined.transformPoint(sprite.x, sprite.y);
        return { x: screen.x, y: screen.y };
      },
      getWorldPoint: (point) => {
        camera.preRender();
        const world = camera.getWorldPoint(point.x, point.y);
        return { x: world.x, y: world.y };
      },
      getSelectedCell: () => (this.selectedCell ? { ...this.selectedCell } : null),
      centerOnCell: (cell) => {
        // Phaser hace zoom sobre el centro del viewport: el scroll es el mundo del borde
        // superior izquierdo sin escalar, así que el centro cae en scroll + tamaño/2.
        const world = gridToScreen(cell, this.layout);
        camera.setScroll(world.x - camera.width / 2, world.y - camera.height / 2);
        camera.preRender();
      },
      injectProjection: (projection) => {
        this.setProjection(projection);
      },
    };
    window.__landlordCameraTest = api;
    const placementApi = () => {
      const target = this.placementTarget;
      const selected = target?.candidates.find((entry) => entry.id === target.selectedCandidateId);
      return {
        candidates: target?.candidates.length ?? 0,
        selectedId: target?.selectedCandidateId ?? null,
        selectedOrientation: selected?.orientation ?? null,
        ghostVisible: this.placementGhost?.visible ?? false,
        ghostCenter:
          this.placementGhost && this.placementGhost.visible
            ? { x: this.placementGhost.x, y: this.placementGhost.y }
            : null,
        selectedFootprint: selected ? selected.footprintCells.map((cell) => ({ ...cell })) : null,
        buildingType: target?.buildingType ?? null,
        parcelIds: target ? [...target.parcelIds] : [],
      };
    };
    window.__landlordPlacementTest = placementApi;
    /** Igual que el registro de texturas: `game.destroy()` avisa con DESTROY, no con SHUTDOWN. */
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      if (window.__landlordCameraTest === api) delete window.__landlordCameraTest;
      if (window.__landlordPlacementTest === placementApi) delete window.__landlordPlacementTest;
    });
  }
}

export const isometricSpikeGameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: 640,
    height: 480,
  },
  backgroundColor: readVisualMood() === "day" ? "#2b3542" : "#101827",
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: [IsometricSpikeScene],
};
