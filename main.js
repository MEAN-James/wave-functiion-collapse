const Utils = {
  roundToNearist: (value, nearest) => Math.round(value / nearest) * nearest,
  randomInt: (min, max) => Math.floor(min + Math.random() * (max - min + 1)),
  randomIndex: (min, max) => Math.floor(min + Math.random() * (max - min)),
};

class ImageObject {
  constructor(path, edges, size) {
    this.path = path;
    this.edges = edges;
    this.top = this.edges[0];
    this.right = this.edges[1];
    this.bottom = this.edges[2];
    this.left = this.edges[3];
    this.size = size;
    this.image = null;
  }
  static rotateEdges(edges, rotations) {
    const newEdges = edges.slice();
    return newEdges
      .splice(edges.length - rotations, rotations)
      .concat(newEdges);
  }
  static createRotatedImage(srcImageObject, rotations, insertArray, index) {
    const emptyCanvas = document.createElement("canvas");
    const ctx = emptyCanvas.getContext("2d");
    const edges = ImageObject.rotateEdges(srcImageObject.edges, rotations);
    const { size } = srcImageObject;
    let width = size;
    let height = size;
    emptyCanvas.width = width;
    emptyCanvas.height = height;
    switch (rotations % 4) {
      case 0:
        break;
      case 1:
        height *= -1;
        break;
      case 2:
        height *= -1;
        width *= -1;
        break;
      case 3:
        width *= -1;
        break;
      default:
        break;
    }
    ctx.rotate(rotations * (1 / 2) * Math.PI);
    ctx.drawImage(srcImageObject.image, 0, 0, width, height);
    return ImageObject.loadImage(
      new ImageObject(emptyCanvas.toDataURL(), edges, size),
      (imageObj) => {
        return insertArray.splice(index, 0, imageObj);
      }
    );
  }
  static loadImage(imageObject, callback) {
    return new Promise((resolve, reject) => {
      let { path, image, size } = imageObject;
      image = new Image(size, size);
      image.onload = () => resolve(image);
      image.onerror = (error) => reject(error);
      image.src = path;
      imageObject.image = image;
      callback(imageObject);
    });
  }
  static loadImages(sourceObjects, array) {
    const promises = [];
    sourceObjects.forEach((sourceObject) => {
      promises.push(
        ImageObject.loadImage(sourceObject, (imageObj) => array.push(imageObj))
      );
    });
    return Promise.all(promises);
  }
}

class Canvas {
  constructor(id, cellSize) {
    this.canvas = document.getElementById(id);
    this.context = this.canvas.getContext("2d");
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.images = [];
    this.grid = [];
    this.cellSize = cellSize;
    this.nRows =
      Utils.roundToNearist(this.height, this.cellSize) / this.cellSize;
    this.nCols =
      Utils.roundToNearist(this.width, this.cellSize) / this.cellSize;
  }

  async preloadImages(callback) {
    const imageSrcs = [];
    const PATH = "tiles";

    imageSrcs.push(
      new ImageObject(
        `${PATH}/Blank.png`,
        ["AAA", "AAA", "AAA", "AAA"],
        this.cellSize
      ),
      new ImageObject(
        `${PATH}/Cross.png`,
        ["ABA", "ABA", "ABA", "ABA"],
        this.cellSize
      ),
      new ImageObject(
        `${PATH}/T-Shape.png`,
        ["AAA", "ABA", "ABA", "ABA"],
        this.cellSize
      ),
      new ImageObject(
        `${PATH}/Straight.png`,
        ["AAA", "ABA", "AAA", "ABA"],
        this.cellSize
      )
    );

    try {
      await ImageObject.loadImages(imageSrcs, this.images);
      await ImageObject.createRotatedImage(this.images[2], 1, this.images, 3);
      await ImageObject.createRotatedImage(this.images[2], 2, this.images, 4);
      await ImageObject.createRotatedImage(this.images[2], 3, this.images, 5);
      await ImageObject.createRotatedImage(this.images[6], 1, this.images, 7);
      callback();
    } catch (error) {
      console.error(error);
    }
  }

  initGrid() {
    this.context.strokeStyle = "#909";
    for (let i = 0; i < this.nRows; i++) {
      this.grid.push(new Array(this.nCols));
      for (let j = 0; j < this.nCols; j++) {
        this.grid[i][j] = new Cell(i, j, this.images, this.cellSize);
        this.context.strokeRect(
          j * this.cellSize,
          i * this.cellSize,
          this.cellSize,
          this.cellSize
        );
      }
    }
  }

  generateSeedTile() {
    const randomRow = Utils.randomIndex(0, this.nRows);
    const randomCol = Utils.randomIndex(0, this.nCols);
    const randomCell = this.grid[randomRow][randomCol];
    const nextCells = randomCell.getNextCells();
    const seenCells = [];
    let possibleCells = [];
    let minEntropy = 0;
    let nextCell = null;

    randomCell.collapseCell();
    this.context.drawImage(
      randomCell.tile.image,
      randomCol * this.cellSize,
      randomRow * this.cellSize,
      this.cellSize,
      this.cellSize
    );

    for (let direction in nextCells) {
      const { i, j } = nextCells[direction];
      let targetCell = null;

      if (i >= this.nRows || i < 0 || j >= this.nCols || j < 0) continue;
      targetCell = this.grid[i][j];
      Cell.updateCell(randomCell, targetCell, direction);
      seenCells.push(targetCell);
    }

    minEntropy = Math.min(...seenCells.map(({ entropy }) => entropy));
    possibleCells = seenCells.filter(
      (cell) => cell.entropy === minEntropy && !cell.collapsed
    );

    nextCell = possibleCells[Utils.randomIndex(0, possibleCells.length)];
    nextCell.collapseCell();

    this.context.drawImage(
      nextCell.tile.image,
      nextCell.j * this.cellSize,
      nextCell.i * this.cellSize,
      this.cellSize,
      this.cellSize
    );
  }
}

class Tile {
  constructor() {
    this.image = null;
    this.edges = null;
    this.top = undefined;
    this.right = undefined;
    this.bottom = undefined;
    this.left = undefined;
  }
  static reverseEdge(edge) {
    return edge === "" ? "" : Tile.reverseEdge(edge.substr(1)) + edge.charAt(0);
  }

  init(possibleTiles) {
    const chosenTile =
      possibleTiles[Utils.randomIndex(0, possibleTiles.length)];

    this.image = chosenTile.image;
    this.edges = chosenTile.edges;
    this.top = this.edges[0];
    this.right = this.edges[1];
    this.bottom = this.edges[2];
    this.left = this.edges[3];
  }
}

class Cell {
  constructor(row, col, imageObjects, size) {
    this.i = row;
    this.j = col;
    this.collapsed = false;
    this.possibleTiles = imageObjects;
    this.entropy = this.possibleTiles.length;
    this.width = size;
    this.height = size;
    this.tile = new Tile();
  }

  static updateCell(cellA, cellB, direction) {
    cellB.possibleTiles = cellB.possibleTiles.filter((tile) => {
      let match = false;
      switch (direction) {
        case "top":
          match = cellA.tile.top === Tile.reverseEdge(tile.bottom);
          break;
        case "right":
          match = cellA.tile.right === Tile.reverseEdge(tile.left);
          break;
        case "bottom":
          match = cellA.tile.bottom === Tile.reverseEdge(tile.top);
        case "left":
          match = cellA.tile.left === Tile.reverseEdge(tile.right);
          break;
        default:
          break;
      }
      return match;
    });
    cellB.entropy = cellB.possibleTiles.length;
  }

  collapseCell() {
    this.tile.init(this.possibleTiles);
    this.collapsed = true;
  }

  getNextCells() {
    const { i, j } = this;
    return {
      top: { i: i - 1, j },
      right: { i, j: j + 1 },
      bottom: { i: i + 1, j },
      left: { i, j: j - 1 },
    };
  }
}

const c = new Canvas("canvas", 75);
c.preloadImages(() => {
  c.initGrid();
  c.generateSeedTile();
});
