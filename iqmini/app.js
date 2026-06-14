/**
 * IQ Mini prototype game logic.
 *
 * This file owns:
 * - static piece and blocker definitions
 * - DOM construction for the board and tray anchors
 * - drag, drop, rotate, flip, reset, and theme interactions
 * - SVG rail generation for the blocker tracks
 */

/**
 * Grid coordinate on the 5x5 board.
 * @typedef {{x: number, y: number}} GridPoint
 */

/**
 * Screen-space coordinate in pixels.
 * @typedef {{x: number, y: number}} PixelPoint
 */

/**
 * Current piece placement, either in the tray ring or on the board.
 * @typedef {{type: "tray", slot: number} | {type: "board", x: number, y: number}} PieceLocation
 */

/**
 * Runtime state for a draggable puzzle piece.
 * @typedef {object} PieceState
 * @property {string} id
 * @property {string} label
 * @property {string} name
 * @property {Array<[number, number]>} cells
 * @property {number} homeSlot
 * @property {number} rotation
 * @property {boolean} flipped
 * @property {PieceLocation} location
 * @property {PixelPoint} pixel
 * @property {number} zIndex
 * @property {HTMLDivElement} element
 */

/**
 * Runtime state for a draggable blocker dot.
 * @typedef {object} BlockerState
 * @property {string} id
 * @property {string} label
 * @property {string} regionClass
 * @property {Array<[number, number]>} allowedCells
 * @property {[number, number]} initialCell
 * @property {Array<[[number, number], [number, number]]>=} blockedTrackSegments
 * @property {GridPoint} cell
 * @property {PixelPoint} pixel
 * @property {number} zIndex
 * @property {HTMLDivElement} element
 */

/**
 * Active pointer drag payload shared by pieces and blockers.
 * @typedef {object} DragState
 * @property {"piece" | "blocker"} kind
 * @property {string} id
 * @property {number} pointerId
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {PieceLocation=} startLocation
 * @property {GridPoint=} startCell
 */

/* Static board and piece data. */

const BOARD_SIZE = 5;

const PIECE_DEFS = [
  {
    id: "piece-o",
    label: "O4",
    name: "Square Tetromino",
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    id: "piece-i3",
    label: "I3",
    name: "Bar Tromino",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
  },
  {
    id: "piece-t4",
    label: "T4",
    name: "T Tetromino",
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
  },
  {
    id: "piece-s4",
    label: "S4",
    name: "Offset Tetromino",
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
  },
  {
    id: "piece-l4",
    label: "L4",
    name: "Hook Tetromino",
    cells: [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 0],
    ],
  },
  {
    id: "piece-v3",
    label: "V3",
    name: "Corner Tromino",
    cells: [
      [0, 1],
      [1, 1],
      [1, 0],
    ],
  },
];

const BLOCKER_DEFS = [
  {
    id: "blocker-a",
    label: "A",
    regionClass: "region-a",
    allowedCells: [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [1, 3],
    ],
    initialCell: [0, 0],
    blockedTrackSegments: [
      [[1, 0], [1, 1]],
    ],
  },
  {
    id: "blocker-b",
    label: "B",
    regionClass: "region-b",
    allowedCells: [
      [3, 0],
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
      [4, 4],
      [3, 4],
    ],
    initialCell: [4, 0],
  },
  {
    id: "blocker-c",
    label: "C",
    regionClass: "region-c",
    allowedCells: [
      [0, 3],
      [0, 4],
      [1, 4],
      [2, 4],
      [2, 3],
      [2, 2],
      [3, 2],
    ],
    initialCell: [0, 4],
  },
];

/* Mutable runtime state that drives rendering and interaction. */

const state = {
  pieces: {},
  blockers: {},
  selectedPieceId: null,
  status: {
    text: "把拼塊拖到棋盤上。",
    tone: "info",
  },
  theme: {
    board: "#ec3f54",
    pieces: "#3f95f3",
    blockers: "#ffffff",
  },
  drag: null,
  boardMetrics: {
    originX: 0,
    originY: 0,
    width: 0,
    height: 0,
  },
  cellSize: 64,
  zCounter: 10,
};

/* Cached DOM references used across all UI flows. */

const refs = {
  board: document.querySelector("#board"),
  playfield: document.querySelector("#playfield"),
  pieceHomes: document.querySelector("#pieceHomes"),
  dragLayer: document.querySelector("#dragLayer"),
  pieceToolbar: document.querySelector("#pieceToolbar"),
  selectedPieceName: document.querySelector("#selectedPieceName"),
  filledCount: document.querySelector("#filledCount"),
  statusText: document.querySelector("#statusText"),
  rotateLeftBtn: document.querySelector("#rotateLeftBtn"),
  rotateRightBtn: document.querySelector("#rotateRightBtn"),
  rotateHalfBtn: document.querySelector("#rotateHalfBtn"),
  flipBtn: document.querySelector("#flipBtn"),
  returnSelectedBtn: document.querySelector("#returnSelectedBtn"),
  resetAllBtn: document.querySelector("#resetAllBtn"),
};

/* Lazily populated collections that are filled during bootstrap. */

const homeSlotElements = [];
const boardCellElements = [];
const swatchButtons = Array.from(document.querySelectorAll(".swatch-button"));

/** @type {SVGSVGElement | null} */
let boardTracksSvg = null;

/** @type {SVGGElement | null} */
let boardTracksGroup = null;

/* Bootstrap immediately because this prototype runs as a plain browser script. */
init();

/**
 * Build the board, pieces, blockers, event bindings, and initial visual state.
 * @returns {void}
 */
function init() {
  buildPieceHomes();
  buildBoard();
  createPieces();
  createBlockers();
  bindControls();
  bindThemeControls();
  window.addEventListener("resize", handleResize);
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  applyTheme();
  handleResize();
  updateSelectionUI();
  updateBoardHighlights();
  updateCounters();
  syncStatus();
  exposeDebugApi();
}

/**
 * Create invisible tray anchors around the board for off-board piece placement.
 * @returns {void}
 */
function buildPieceHomes() {
  PIECE_DEFS.forEach((piece, index) => {
    const slot = document.createElement("div");
    slot.className = `piece-home dock-${index}`;
    slot.dataset.slotId = String(index);
    slot.setAttribute("aria-hidden", "true");
    refs.pieceHomes.appendChild(slot);
    homeSlotElements.push(slot);
  });
}

/**
 * Create the SVG track layer and the 5x5 board cell DOM structure.
 * @returns {void}
 */
function buildBoard() {
  boardTracksSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  boardTracksSvg.setAttribute("class", "board-tracks");
  boardTracksSvg.setAttribute("aria-hidden", "true");

  boardTracksGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  boardTracksSvg.appendChild(boardTracksGroup);
  refs.board.appendChild(boardTracksSvg);

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const cell = document.createElement("div");
      cell.className = "board-cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      const hole = document.createElement("span");
      hole.className = "board-hole";
      cell.appendChild(hole);

      refs.board.appendChild(cell);
      boardCellElements.push(cell);
    }
  }
}

/**
 * Instantiate all puzzle pieces from their definitions and wire pointer/click events.
 * @returns {void}
 */
function createPieces() {
  PIECE_DEFS.forEach((definition, index) => {
    const piece = {
      ...definition,
      homeSlot: index,
      rotation: 0,
      flipped: false,
      location: { type: "tray", slot: index },
      pixel: { x: 0, y: 0 },
      zIndex: state.zCounter + index,
      element: document.createElement("div"),
    };

    piece.element.className = "piece";
    piece.element.dataset.pieceId = piece.id;
    piece.element.setAttribute("aria-label", piece.name);
    piece.element.addEventListener("pointerdown", (event) => beginPieceDrag(event, piece.id));
    piece.element.addEventListener("click", () => selectPiece(piece.id));

    refs.dragLayer.appendChild(piece.element);
    state.pieces[piece.id] = piece;
  });
}

/**
 * Instantiate blocker dots and place them at their configured starting cells.
 * @returns {void}
 */
function createBlockers() {
  BLOCKER_DEFS.forEach((definition) => {
    const blocker = {
      ...definition,
      cell: { x: definition.initialCell[0], y: definition.initialCell[1] },
      pixel: { x: 0, y: 0 },
      zIndex: state.zCounter + 50,
      element: document.createElement("div"),
    };

    blocker.element.className = `blocker ${blocker.regionClass}`;
    blocker.element.dataset.blockerId = blocker.id;
    blocker.element.setAttribute("aria-label", "movable blocker");
    blocker.element.addEventListener("pointerdown", (event) => beginBlockerDrag(event, blocker.id));

    refs.dragLayer.appendChild(blocker.element);
    state.blockers[blocker.id] = blocker;
  });
}

/**
 * Bind rotation, flip, return, and reset controls.
 * @returns {void}
 */
function bindControls() {
  refs.rotateLeftBtn.addEventListener("click", () => rotateSelected(-1));
  refs.rotateRightBtn.addEventListener("click", () => rotateSelected(1));
  refs.rotateHalfBtn.addEventListener("click", () => rotateSelected(2));
  refs.flipBtn.addEventListener("click", () => flipSelected());
  refs.returnSelectedBtn.addEventListener("click", () => returnSelectedPieceToTray());
  refs.resetAllBtn.addEventListener("click", resetAll);
}

/**
 * Bind palette buttons so theme state can update the live CSS variables.
 * @returns {void}
 */
function bindThemeControls() {
  swatchButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.themeTarget;
      const color = button.dataset.color;
      state.theme[target] = color;
      applyTheme();
    });
  });
}

/**
 * Push the runtime theme into CSS custom properties and refresh swatch selection UI.
 * @returns {void}
 */
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--board-base", state.theme.board);
  root.style.setProperty("--board-deep", mixHex(state.theme.board, "#5e0817", 0.22));
  root.style.setProperty("--board-rim", mixHex(state.theme.board, "#ffffff", 0.18));
  root.style.setProperty("--piece-base", state.theme.pieces);
  root.style.setProperty("--piece-dark", mixHex(state.theme.pieces, "#15396e", 0.28));
  root.style.setProperty("--piece-light", mixHex(state.theme.pieces, "#ffffff", 0.3));
  root.style.setProperty("--blocker-base", state.theme.blockers);
  root.style.setProperty("--blocker-dark", mixHex(state.theme.blockers, "#5e6871", 0.24));
  root.style.setProperty("--blocker-light", mixHex(state.theme.blockers, "#ffffff", 0.55));
  root.style.setProperty("--blocker-label", getContrastColor(state.theme.blockers));
  syncSwatches();
}

/**
 * Re-measure the live board geometry and reposition all movable elements after resize.
 * @returns {void}
 */
function handleResize() {
  const firstCellRect = boardCellElements[0]?.getBoundingClientRect();
  const lastCellRect = boardCellElements[boardCellElements.length - 1]?.getBoundingClientRect();

  if (!firstCellRect || !lastCellRect) {
    return;
  }

  // Measure real rendered cells instead of outer board chrome so snapping stays exact.
  state.cellSize = firstCellRect.width;
  state.boardMetrics = {
    originX: firstCellRect.left,
    originY: firstCellRect.top,
    width: lastCellRect.right - firstCellRect.left,
    height: lastCellRect.bottom - firstCellRect.top,
  };
  document.documentElement.style.setProperty("--cell-size", `${state.cellSize}px`);
  renderBoardTracks();

  Object.values(state.pieces).forEach((piece) => {
    renderPieceGeometry(piece);
    if (!isDraggingPiece(piece.id)) {
      positionPiece(piece, getTargetPixelForPiece(piece));
    }
  });

  Object.values(state.blockers).forEach((blocker) => {
    renderBlocker(blocker);
    if (!isDraggingBlocker(blocker.id)) {
      positionBlocker(blocker, getTargetPixelForBlocker(blocker));
    }
  });

  updateSelectionUI();
}

/**
 * Clear piece selection when the user clicks outside pieces, blockers, and controls.
 * @param {PointerEvent} event
 * @returns {void}
 */
function handleDocumentPointerDown(event) {
  const pieceElement = event.target.closest(".piece");
  if (!pieceElement && !event.target.closest(".blocker") && !event.target.closest("button, input, label")) {
    selectPiece(null);
  }
}

/**
 * Start dragging a piece and store the pointer offset required for smooth movement.
 * @param {PointerEvent} event
 * @param {string} pieceId
 * @returns {void}
 */
function beginPieceDrag(event, pieceId) {
  event.preventDefault();
  selectPiece(pieceId);

  const piece = state.pieces[pieceId];
  const rect = piece.element.getBoundingClientRect();
  piece.element.classList.add("dragging");
  piece.element.style.zIndex = String(++state.zCounter);

  state.drag = {
    kind: "piece",
    id: pieceId,
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    startLocation: structuredClone(piece.location),
  };

  refs.pieceToolbar.classList.add("is-hidden");

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerUp);
}

/**
 * Start dragging a blocker and remember its original cell for invalid-drop rollback.
 * @param {PointerEvent} event
 * @param {string} blockerId
 * @returns {void}
 */
function beginBlockerDrag(event, blockerId) {
  event.preventDefault();
  selectPiece(null);
  const blocker = state.blockers[blockerId];
  const rect = blocker.element.getBoundingClientRect();
  blocker.element.classList.add("dragging");
  blocker.element.style.zIndex = String(++state.zCounter);

  state.drag = {
    kind: "blocker",
    id: blockerId,
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    startCell: { ...blocker.cell },
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerUp);
}

/**
 * Update the screen position of the active drag target while the pointer moves.
 * @param {PointerEvent} event
 * @returns {void}
 */
function handlePointerMove(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) {
    return;
  }

  if (state.drag.kind === "piece") {
    const piece = state.pieces[state.drag.id];
    positionPiece(piece, {
      x: event.clientX - state.drag.offsetX,
      y: event.clientY - state.drag.offsetY,
    });
  }

  if (state.drag.kind === "blocker") {
    const blocker = state.blockers[state.drag.id];
    positionBlocker(blocker, {
      x: event.clientX - state.drag.offsetX,
      y: event.clientY - state.drag.offsetY,
    });
  }
}

/**
 * Finish the current drag interaction and delegate to the matching drop resolver.
 * @param {PointerEvent} event
 * @returns {void}
 */
function handlePointerUp(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) {
    return;
  }

  const dragState = state.drag;
  state.drag = null;

  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerup", handlePointerUp);
  window.removeEventListener("pointercancel", handlePointerUp);

  if (dragState.kind === "piece") {
    finishPieceDrag(dragState);
  }

  if (dragState.kind === "blocker") {
    finishBlockerDrag(dragState);
  }

  updateBoardHighlights();
  updateCounters();
  syncStatus();
}

/**
 * Resolve a released piece by snapping to the board, returning to tray, or restoring start state.
 * @param {{id: string, startLocation: PieceLocation}} dragState
 * @returns {void}
 */
function finishPieceDrag(dragState) {
  const piece = state.pieces[dragState.id];
  piece.element.classList.remove("dragging");

  const boardPlacement = getBoardPlacementFromPixel(piece);
  if (boardPlacement && canPlacePiece(piece, boardPlacement.x, boardPlacement.y, piece.id)) {
    piece.location = { type: "board", x: boardPlacement.x, y: boardPlacement.y };
    positionPiece(piece, getTargetPixelForPiece(piece));
    setStatus(`已將 ${piece.label} 放到棋盤上。`, "info");
    updateSelectionUI();
    return;
  }

  const pieceCenter = getPieceCenter(piece);
  const isInPlayfield = isPointInsideRect(pieceCenter, refs.playfield.getBoundingClientRect());
  const isInBoard = isPointInsideRect(pieceCenter, refs.board.getBoundingClientRect());
  if (isInPlayfield && !isInBoard) {
    piece.location = { type: "tray", slot: piece.homeSlot };
    positionPiece(piece, getTargetPixelForPiece(piece));
    setStatus(`已將 ${piece.label} 放回旁邊。`, "info");
    updateSelectionUI();
    return;
  }

  piece.location = dragState.startLocation;
  positionPiece(piece, getTargetPixelForPiece(piece));
  setStatus("這個位置放不下拼塊。", "error");
  updateSelectionUI();
}

/**
 * Resolve a released blocker by snapping to the nearest legal cell or restoring its start cell.
 * @param {{id: string, startCell: GridPoint}} dragState
 * @returns {void}
 */
function finishBlockerDrag(dragState) {
  const blocker = state.blockers[dragState.id];
  blocker.element.classList.remove("dragging");

  const targetCell = getClosestAllowedCell(blocker);
  if (targetCell && canPlaceBlocker(blocker, targetCell.x, targetCell.y)) {
    blocker.cell = targetCell;
    positionBlocker(blocker, getTargetPixelForBlocker(blocker));
    setStatus(`已移動 blocker ${blocker.label}。`, "info");
    return;
  }

  blocker.cell = dragState.startCell;
  positionBlocker(blocker, getTargetPixelForBlocker(blocker));
  setStatus("blocker 不能移到那裡。", "error");
}

/**
 * Rotate the selected piece in quarter turns while preserving legal placement.
 * @param {number} step
 * @returns {void}
 */
function rotateSelected(step) {
  const piece = getSelectedPiece();
  if (!piece) {
    return;
  }

  const previousRotation = piece.rotation;
  piece.rotation = normalizeRotation(piece.rotation + step);
  renderPieceGeometry(piece);

  if (piece.location.type === "board" && !canPlacePiece(piece, piece.location.x, piece.location.y, piece.id)) {
    piece.rotation = previousRotation;
    renderPieceGeometry(piece);
    positionPiece(piece, getTargetPixelForPiece(piece));
    setStatus("這個角度會撞到別的拼塊。", "error");
    return;
  }

  positionPiece(piece, getTargetPixelForPiece(piece));
  updateCounters();
  updateBoardHighlights();
  setStatus(`已旋轉 ${piece.label}。`, "info");
  updateSelectionUI();
}

/**
 * Flip the selected piece horizontally and revert if the new orientation is illegal.
 * @returns {void}
 */
function flipSelected() {
  const piece = getSelectedPiece();
  if (!piece) {
    return;
  }

  const previousFlip = piece.flipped;
  piece.flipped = !piece.flipped;
  renderPieceGeometry(piece);

  if (piece.location.type === "board" && !canPlacePiece(piece, piece.location.x, piece.location.y, piece.id)) {
    piece.flipped = previousFlip;
    renderPieceGeometry(piece);
    positionPiece(piece, getTargetPixelForPiece(piece));
    setStatus("翻面後超出棋盤。", "error");
    return;
  }

  positionPiece(piece, getTargetPixelForPiece(piece));
  updateCounters();
  updateBoardHighlights();
  setStatus(`已翻轉 ${piece.label}。`, "info");
  updateSelectionUI();
}

/**
 * Return the currently selected piece to its tray home.
 * @returns {void}
 */
function returnSelectedPieceToTray() {
  const piece = getSelectedPiece();
  if (!piece) {
    return;
  }

  piece.location = { type: "tray", slot: piece.homeSlot };
  positionPiece(piece, getTargetPixelForPiece(piece));
  updateBoardHighlights();
  updateCounters();
  setStatus(`已將 ${piece.label} 放回旁邊。`, "info");
  updateSelectionUI();
}

/**
 * Reset every piece and blocker back to its initial state.
 * @returns {void}
 */
function resetAll() {
  Object.values(state.pieces).forEach((piece) => {
    piece.rotation = 0;
    piece.flipped = false;
    piece.location = { type: "tray", slot: piece.homeSlot };
    renderPieceGeometry(piece);
    positionPiece(piece, getTargetPixelForPiece(piece));
  });

  Object.values(state.blockers).forEach((blocker) => {
    blocker.cell = { x: blocker.initialCell[0], y: blocker.initialCell[1] };
    positionBlocker(blocker, getTargetPixelForBlocker(blocker));
  });

  setStatus("已重設。", "info");
  updateBoardHighlights();
  updateCounters();
  updateSelectionUI();
}

/* Selection, rendering, and placement helpers. */

/**
 * Return the currently selected piece, if any.
 * @returns {PieceState | null}
 */
function getSelectedPiece() {
  return state.selectedPieceId ? state.pieces[state.selectedPieceId] : null;
}

/**
 * Mark a piece as selected and synchronize its visual selection state.
 * @param {string | null} pieceId
 * @returns {void}
 */
function selectPiece(pieceId) {
  state.selectedPieceId = pieceId;
  Object.values(state.pieces).forEach((piece) => {
    piece.element.classList.toggle("selected", piece.id === pieceId);
  });
  updateSelectionUI();
}

/**
 * Refresh toolbar content, disabled states, and toolbar placement for the current selection.
 * @returns {void}
 */
function updateSelectionUI() {
  const piece = getSelectedPiece();
  refs.selectedPieceName.textContent = piece ? piece.label : "選一塊";
  const disabled = !piece;
  refs.rotateLeftBtn.disabled = disabled;
  refs.rotateRightBtn.disabled = disabled;
  refs.rotateHalfBtn.disabled = disabled;
  refs.flipBtn.disabled = disabled;
  refs.returnSelectedBtn.disabled = disabled;

  if (!piece || isDraggingPiece(piece.id)) {
    refs.pieceToolbar.classList.add("is-hidden");
    return;
  }

  refs.pieceToolbar.classList.remove("is-hidden");
  positionPieceToolbar(piece);
}

/**
 * Render one piece as links plus beads based on its transformed cell layout.
 * @param {PieceState} piece
 * @returns {void}
 */
function renderPieceGeometry(piece) {
  const cells = getTransformedCells(piece);
  const { width, height } = getBounds(cells);
  const beadSize = state.cellSize * 0.78;
  const beadInset = (state.cellSize - beadSize) / 2;
  const linkThickness = state.cellSize * 0.4;
  const linkInset = (state.cellSize - linkThickness) / 2;

  piece.element.replaceChildren();
  piece.element.style.width = `${width * state.cellSize}px`;
  piece.element.style.height = `${height * state.cellSize}px`;
  piece.element.style.zIndex = String(piece.zIndex);

  const cellSet = new Set(cells.map(([x, y]) => `${x},${y}`));

  // Draw links first so beads can sit on top and keep the stacked toy-plastic look.
  cells.forEach(([x, y]) => {
    if (cellSet.has(`${x + 1},${y}`)) {
      const connector = document.createElement("span");
      connector.className = "piece-link horizontal";
      connector.style.left = `${x * state.cellSize + state.cellSize / 2}px`;
      connector.style.top = `${y * state.cellSize + linkInset}px`;
      connector.style.width = `${state.cellSize}px`;
      connector.style.height = `${linkThickness}px`;
      piece.element.appendChild(connector);
    }

    if (cellSet.has(`${x},${y + 1}`)) {
      const connector = document.createElement("span");
      connector.className = "piece-link vertical";
      connector.style.left = `${x * state.cellSize + linkInset}px`;
      connector.style.top = `${y * state.cellSize + state.cellSize / 2}px`;
      connector.style.width = `${linkThickness}px`;
      connector.style.height = `${state.cellSize}px`;
      piece.element.appendChild(connector);
    }
  });

  cells.forEach(([x, y]) => {
    const bead = document.createElement("span");
    bead.className = "piece-bead";
    bead.style.width = `${beadSize}px`;
    bead.style.height = `${beadSize}px`;
    bead.style.left = `${x * state.cellSize + beadInset}px`;
    bead.style.top = `${y * state.cellSize + beadInset}px`;
    piece.element.appendChild(bead);
  });
}

function renderBlocker(blocker) {
/**
 * Resize the blocker dot to match the current board cell scale.
 * @param {BlockerState} blocker
 * @returns {void}
 */
  const size = state.cellSize * 0.84;
  blocker.element.style.width = `${size}px`;
  blocker.element.style.height = `${size}px`;
  blocker.element.style.lineHeight = `${size}px`;
}

function positionPiece(piece, pixel) {
/**
 * Position a piece in viewport pixels and keep the floating toolbar attached when needed.
 * @param {PieceState} piece
 * @param {PixelPoint} pixel
 * @returns {void}
 */
  piece.pixel = pixel;
  piece.element.style.left = `${pixel.x}px`;
  piece.element.style.top = `${pixel.y}px`;

  if (state.selectedPieceId === piece.id && !isDraggingPiece(piece.id)) {
    positionPieceToolbar(piece);
  }
}

/**
 * Position a blocker dot in viewport pixels.
 * @param {BlockerState} blocker
 * @param {PixelPoint} pixel
 * @returns {void}
 */
function positionBlocker(blocker, pixel) {
  blocker.pixel = pixel;
  blocker.element.style.left = `${pixel.x}px`;
  blocker.element.style.top = `${pixel.y}px`;
}

/**
 * Compute the top-left screen pixel where a piece should rest for its current location.
 * @param {PieceState} piece
 * @returns {PixelPoint}
 */
function getTargetPixelForPiece(piece) {
  const pieceRect = getPieceRect(piece);
  if (piece.location.type === "tray") {
    const slotRect = homeSlotElements[piece.location.slot].getBoundingClientRect();
    const playfieldRect = refs.playfield.getBoundingClientRect();
    const rawX = slotRect.left + (slotRect.width - pieceRect.width) / 2;
    const rawY = slotRect.top + (slotRect.height - pieceRect.height) / 2;
    return {
      x: clamp(rawX, playfieldRect.left + 4, playfieldRect.right - pieceRect.width - 4),
      y: clamp(rawY, playfieldRect.top + 4, playfieldRect.bottom - pieceRect.height - 4),
    };
  }

  const { originX, originY } = state.boardMetrics;
  return {
    x: originX + piece.location.x * state.cellSize,
    y: originY + piece.location.y * state.cellSize,
  };
}

/**
 * Compute the centered screen pixel where a blocker should rest for its current cell.
 * @param {BlockerState} blocker
 * @returns {PixelPoint}
 */
function getTargetPixelForBlocker(blocker) {
  const { originX, originY } = state.boardMetrics;
  const blockerSize = state.cellSize * 0.76;
  return {
    x: originX + blocker.cell.x * state.cellSize + (state.cellSize - blockerSize) / 2,
    y: originY + blocker.cell.y * state.cellSize + (state.cellSize - blockerSize) / 2,
  };
}

/**
 * Convert a dragged piece pixel position into a board origin cell when overlap is valid.
 * @param {PieceState} piece
 * @returns {GridPoint | null}
 */
function getBoardPlacementFromPixel(piece) {
  const pieceRect = getPieceRect(piece);
  const boardRect = refs.board.getBoundingClientRect();
  const { originX, originY, width, height } = state.boardMetrics;
  const pieceBounds = {
    left: piece.pixel.x,
    top: piece.pixel.y,
    right: piece.pixel.x + pieceRect.width,
    bottom: piece.pixel.y + pieceRect.height,
  };

  if (!rectsOverlap(pieceBounds, boardRect)) {
    return null;
  }

  // Use the measured inner grid bounds so padding and decorative board rim do not skew snapping.
  const innerBoardBounds = {
    left: originX,
    top: originY,
    right: originX + width,
    bottom: originY + height,
  };

  if (!rectsOverlap(pieceBounds, innerBoardBounds)) {
    return null;
  }

  return {
    x: Math.round((piece.pixel.x - originX) / state.cellSize),
    y: Math.round((piece.pixel.y - originY) / state.cellSize),
  };
}

/**
 * Snap a blocker to the nearest allowed cell center within a reasonable drag distance.
 * @param {BlockerState} blocker
 * @returns {GridPoint | null}
 */
function getClosestAllowedCell(blocker) {
  const blockerCenter = getBlockerCenter(blocker);
  let bestCell = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  blocker.allowedCells.forEach(([x, y]) => {
    const center = getBoardCellCenter(x, y);
    const distance = Math.hypot(center.x - blockerCenter.x, center.y - blockerCenter.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCell = { x, y };
    }
  });

  return bestDistance <= state.cellSize * 0.9 ? bestCell : null;
}

/**
 * Check whether a piece can occupy a given board origin without colliding or leaving bounds.
 * @param {PieceState} piece
 * @param {number} originX
 * @param {number} originY
 * @param {string | null} [ignorePieceId=null]
 * @returns {boolean}
 */
function canPlacePiece(piece, originX, originY, ignorePieceId = null) {
  const occupiedByPieces = getPieceOccupancy(ignorePieceId);
  const blockerCells = getBlockerOccupancy();

  return getTransformedCells(piece).every(([offsetX, offsetY]) => {
    const targetX = originX + offsetX;
    const targetY = originY + offsetY;
    const key = `${targetX},${targetY}`;

    return (
      targetX >= 0 &&
      targetY >= 0 &&
      targetX < BOARD_SIZE &&
      targetY < BOARD_SIZE &&
      !occupiedByPieces.has(key) &&
      !blockerCells.has(key)
    );
  });
}

/**
 * Check whether a blocker can move onto a given cell.
 * @param {BlockerState} blocker
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function canPlaceBlocker(blocker, x, y) {
  const isAllowed = blocker.allowedCells.some(([allowedX, allowedY]) => allowedX === x && allowedY === y);
  if (!isAllowed) {
    return false;
  }

  const blockerOccupancy = getBlockerOccupancy(blocker.id);
  if (blockerOccupancy.has(`${x},${y}`)) {
    return false;
  }

  const pieceOccupancy = getPieceOccupancy();
  return !pieceOccupancy.has(`${x},${y}`);
}

/**
 * Collect every board cell currently occupied by placed pieces.
 * @param {string | null} [ignorePieceId=null]
 * @returns {Set<string>}
 */
function getPieceOccupancy(ignorePieceId = null) {
  const occupied = new Set();
  Object.values(state.pieces).forEach((piece) => {
    if (piece.location.type !== "board" || piece.id === ignorePieceId) {
      return;
    }

    getTransformedCells(piece).forEach(([offsetX, offsetY]) => {
      occupied.add(`${piece.location.x + offsetX},${piece.location.y + offsetY}`);
    });
  });
  return occupied;
}

/**
 * Collect every board cell currently occupied by blockers.
 * @param {string | null} [ignoreBlockerId=null]
 * @returns {Set<string>}
 */
function getBlockerOccupancy(ignoreBlockerId = null) {
  const occupied = new Set();
  Object.values(state.blockers).forEach((blocker) => {
    if (blocker.id !== ignoreBlockerId) {
      occupied.add(`${blocker.cell.x},${blocker.cell.y}`);
    }
  });
  return occupied;
}

/**
 * Mark board cells that currently contain blockers so the board visuals stay in sync.
 * @returns {void}
 */
function updateBoardHighlights() {
  const blockerSet = getBlockerOccupancy();
  boardCellElements.forEach((cell) => {
    const key = `${cell.dataset.x},${cell.dataset.y}`;
    cell.classList.toggle("blocker-cell", blockerSet.has(key));
  });
}

/**
 * Update the filled-cell counter and emit a completion message when the board is solved.
 * @returns {void}
 */
function updateCounters() {
  const filledByPieces = Array.from(getPieceOccupancy()).length;
  const blockerCount = Object.keys(state.blockers).length;
  const filled = filledByPieces + blockerCount;
  refs.filledCount.textContent = `${filled} / 25`;

  const allPiecesPlaced = Object.values(state.pieces).every((piece) => piece.location.type === "board");
  const isDone = filled === 25 && allPiecesPlaced;
  refs.filledCount.classList.toggle("is-done", isDone);

  if (isDone) {
    setStatus("完成。", "success");
  }
}

/**
 * Store a status message and immediately mirror it into the DOM.
 * @param {string} text
 * @param {string} tone
 * @returns {void}
 */
function setStatus(text, tone) {
  state.status = { text, tone };
  syncStatus();
}

/**
 * Render the current status text into the status label.
 * @returns {void}
 */
function syncStatus() {
  refs.statusText.textContent = state.status.text;
}

/* Geometry, math, color, and debug utilities. */

/**
 * Apply flip and rotation transforms, then normalize a piece back into a zero-based local grid.
 * @param {PieceState} piece
 * @returns {Array<[number, number]>}
 */
function getTransformedCells(piece) {
  const transformed = piece.cells.map(([x, y]) => {
    let transformedX = x;
    let transformedY = y;

    if (piece.flipped) {
      transformedX = -transformedX;
    }

    for (let rotation = 0; rotation < piece.rotation; rotation += 1) {
      const nextX = transformedY;
      const nextY = -transformedX;
      transformedX = nextX;
      transformedY = nextY;
    }

    return [transformedX, transformedY];
  });

  const minX = Math.min(...transformed.map(([x]) => x));
  const minY = Math.min(...transformed.map(([, y]) => y));

  // Normalize the transformed shape so downstream layout always starts from local 0,0.
  return transformed
    .map(([x, y]) => [x - minX, y - minY])
    .sort((first, second) => first[1] - second[1] || first[0] - second[0]);
}

/**
 * Return the width and height of a local cell set.
 * @param {Array<[number, number]>} cells
 * @returns {{width: number, height: number}}
 */
function getBounds(cells) {
  const maxX = Math.max(...cells.map(([x]) => x));
  const maxY = Math.max(...cells.map(([, y]) => y));
  return {
    width: maxX + 1,
    height: maxY + 1,
  };
}

/**
 * Return the current rendered pixel bounds of a piece.
 * @param {PieceState} piece
 * @returns {{width: number, height: number}}
 */
function getPieceRect(piece) {
  const bounds = getBounds(getTransformedCells(piece));
  return {
    width: bounds.width * state.cellSize,
    height: bounds.height * state.cellSize,
  };
}

/**
 * Normalize a rotation step into the inclusive range 0..3.
 * @param {number} rotation
 * @returns {number}
 */
function normalizeRotation(rotation) {
  return ((rotation % 4) + 4) % 4;
}

/**
 * Report whether the given piece is currently being dragged.
 * @param {string} pieceId
 * @returns {boolean}
 */
function isDraggingPiece(pieceId) {
  return state.drag && state.drag.kind === "piece" && state.drag.id === pieceId;
}

/**
 * Report whether the given blocker is currently being dragged.
 * @param {string} blockerId
 * @returns {boolean}
 */
function isDraggingBlocker(blockerId) {
  return state.drag && state.drag.kind === "blocker" && state.drag.id === blockerId;
}

/**
 * Return the visual center of a piece in screen pixels.
 * @param {PieceState} piece
 * @returns {PixelPoint}
 */
function getPieceCenter(piece) {
  const rect = getPieceRect(piece);
  return {
    x: piece.pixel.x + rect.width / 2,
    y: piece.pixel.y + rect.height / 2,
  };
}

/**
 * Return the visual center of a blocker in screen pixels.
 * @param {BlockerState} blocker
 * @returns {PixelPoint}
 */
function getBlockerCenter(blocker) {
  const blockerSize = state.cellSize * 0.76;
  return {
    x: blocker.pixel.x + blockerSize / 2,
    y: blocker.pixel.y + blockerSize / 2,
  };
}

/**
 * Return the rendered center point of one board cell.
 * @param {number} x
 * @param {number} y
 * @returns {PixelPoint}
 */
function getBoardCellCenter(x, y) {
  const { originX, originY } = state.boardMetrics;
  return {
    x: originX + x * state.cellSize + state.cellSize / 2,
    y: originY + y * state.cellSize + state.cellSize / 2,
  };
}

/**
 * Check whether a point lies inside a rectangle.
 * @param {PixelPoint} point
 * @param {{left: number, right: number, top: number, bottom: number}} rect
 * @returns {boolean}
 */
function isPointInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

/**
 * Check whether two rectangles overlap.
 * @param {{left: number, right: number, top: number, bottom: number}} a
 * @param {{left: number, right: number, top: number, bottom: number}} b
 * @returns {boolean}
 */
function rectsOverlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/**
 * Blend two hex colors by the supplied ratio.
 * @param {string} firstHex
 * @param {string} secondHex
 * @param {number} amount
 * @returns {string}
 */
function mixHex(firstHex, secondHex, amount) {
  const first = hexToRgb(firstHex);
  const second = hexToRgb(secondHex);
  const ratio = Math.min(Math.max(amount, 0), 1);
  const red = Math.round(first.red * (1 - ratio) + second.red * ratio);
  const green = Math.round(first.green * (1 - ratio) + second.green * ratio);
  const blue = Math.round(first.blue * (1 - ratio) + second.blue * ratio);
  return rgbToHex(red, green, blue);
}

/**
 * Convert a hex color string into RGB channels.
 * @param {string} hex
 * @returns {{red: number, green: number, blue: number}}
 */
function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((digit) => digit + digit)
        .join("")
    : normalized;

  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
  };
}

/**
 * Convert RGB channel values into a hex color string.
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @returns {string}
 */
function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Choose a readable foreground color for the supplied background color.
 * @param {string} hex
 * @returns {string}
 */
function getContrastColor(hex) {
  const { red, green, blue } = hexToRgb(hex);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance >= 168 ? "#1f2c39" : "#ffffff";
}

/**
 * Expose a minimal debug API on window for quick runtime inspection.
 * @returns {void}
 */
function exposeDebugApi() {
  window.iqMiniDebug = {
    /**
     * Return a serializable snapshot for browser-console inspection and automated checks.
     * @returns {{
     *   pieces: Array<{id: string, label: string, rotation: number, flipped: boolean, location: PieceLocation}>,
     *   blockers: Array<{id: string, cell: GridPoint}>,
     *   status: {text: string, tone: string},
     *   theme: {board: string, pieces: string, blockers: string}
     * }}
     */
    snapshot() {
      return {
        pieces: Object.values(state.pieces).map((piece) => ({
          id: piece.id,
          label: piece.label,
          rotation: piece.rotation,
          flipped: piece.flipped,
          location: piece.location,
        })),
        blockers: Object.values(state.blockers).map((blocker) => ({
          id: blocker.id,
          cell: blocker.cell,
        })),
        status: state.status,
        theme: state.theme,
      };
    },
  };
}

/**
 * Sync active palette button visuals with the current theme state.
 * @returns {void}
 */
function syncSwatches() {
  swatchButtons.forEach((button) => {
    const target = button.dataset.themeTarget;
    const color = button.dataset.color;
    const isActive = state.theme[target] === color;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

/**
 * Position the floating piece toolbar next to the selected piece while keeping it onscreen.
 * @param {PieceState} piece
 * @returns {void}
 */
function positionPieceToolbar(piece) {
  const rect = getPieceRect(piece);
  const toolbarRect = refs.pieceToolbar.getBoundingClientRect();
  const gap = 10;
  let left = piece.pixel.x + rect.width + gap;

  if (left + toolbarRect.width > window.innerWidth - 8) {
    left = piece.pixel.x - toolbarRect.width - gap;
  }

  if (left < 8) {
    left = window.innerWidth - toolbarRect.width - 8;
  }

  const centerY = piece.pixel.y + rect.height / 2 - toolbarRect.height / 2;
  const top = clamp(centerY, 8, window.innerHeight - toolbarRect.height - 8);

  refs.pieceToolbar.style.left = `${left}px`;
  refs.pieceToolbar.style.top = `${top}px`;
}

/**
 * Clamp a numeric value into a min/max range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Render SVG track segments between all adjacent allowed blocker cells.
 * @returns {void}
 */
function renderBoardTracks() {
  if (!boardTracksSvg || !boardTracksGroup || boardCellElements.length === 0) {
    return;
  }

  const boardRect = refs.board.getBoundingClientRect();
  boardTracksSvg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
  boardTracksSvg.setAttribute("width", String(boardRect.width));
  boardTracksSvg.setAttribute("height", String(boardRect.height));
  boardTracksGroup.replaceChildren();

  const centers = new Map();
  boardCellElements.forEach((cell) => {
    const rect = cell.getBoundingClientRect();
    const key = `${cell.dataset.x},${cell.dataset.y}`;
    centers.set(key, {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2,
    });
  });

  const segments = getTrackSegmentsFromRegions();
  segments.forEach(([fromKey, toKey]) => {
    appendTrackLine(centers.get(fromKey), centers.get(toKey));
  });

  /**
   * Draw one SVG line segment between two board-cell centers.
   * @param {PixelPoint | undefined} start
   * @param {PixelPoint | undefined} end
   * @returns {void}
   */
  function appendTrackLine(start, end) {
    if (!start || !end) {
      return;
    }

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "board-track-line");
    line.setAttribute("x1", String(start.x));
    line.setAttribute("y1", String(start.y));
    line.setAttribute("x2", String(end.x));
    line.setAttribute("y2", String(end.y));
    line.setAttribute("stroke-width", String(Math.max(state.cellSize * 0.4, 16)));
    boardTracksGroup.appendChild(line);
  }
}

/**
 * Build the set of board-track segments from blocker regions, honoring any explicit breaks.
 * @returns {Array<[string, string]>}
 */
function getTrackSegmentsFromRegions() {
  const segments = [];

  BLOCKER_DEFS.forEach((blocker) => {
    const allowed = new Set(blocker.allowedCells.map(([x, y]) => `${x},${y}`));

    // Store both directions so a blocked segment can be suppressed regardless of traversal order.
    const blockedSegments = new Set(
      (blocker.blockedTrackSegments ?? []).flatMap(([[fromX, fromY], [toX, toY]]) => {
        const fromKey = `${fromX},${fromY}`;
        const toKey = `${toX},${toY}`;
        return [`${fromKey}|${toKey}`, `${toKey}|${fromKey}`];
      }),
    );

    blocker.allowedCells.forEach(([x, y]) => {
      const key = `${x},${y}`;
      const rightKey = `${x + 1},${y}`;
      const downKey = `${x},${y + 1}`;

      if (allowed.has(rightKey) && !blockedSegments.has(`${key}|${rightKey}`)) {
        segments.push([key, rightKey]);
      }

      if (allowed.has(downKey) && !blockedSegments.has(`${key}|${downKey}`)) {
        segments.push([key, downKey]);
      }
    });
  });

  return segments;
}