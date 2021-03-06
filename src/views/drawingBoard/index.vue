<template>
    <div>
        <canvas
                @mousedown="onMouseDown"
                @mousemove="onMouseMove"
                @mouseup="onMouseUp"
                id="canvas" width='600' height='600'>Canvas not supported</canvas>
        <ul id='controls'>
            <li>
                <label for="color">颜色</label>
                <select id="color" v-model="color">
                    <option value='red'>red</option>
                    <option value='green'>green</option>
                    <option value='blue'>blue</option>
                    <option value='orange'>orange</option>
                    <option value='cornflowerblue' selected>cornflowerblue</option>
                    <option value='goldenrod'>goldenrod</option>
                    <option value='navy'>navy</option>
                    <option value='purple'>purple</option>
                </select>
            </li>
            <li>
                <label for="shape">形状</label>
                <select id="shape" v-model="shape" @change="mode='normal'">
                    <option value='Circle'>circle</option>
                    <option value='Line'>line</option>
                    <option value='RoundedRect'>RoundedRect</option>
                    <option value='Polygon'>Polygon</option>
                    <option value='BezierCurve'>BezierCurve</option>
                </select>
            </li>
            <li v-show="shape === 'Polygon'">
                <label for="sides">边数</label>
                <input type="text" id="sides" v-model="sides">
            </li>
            <li>
                <label for="normal-radio">画图</label>
                <input type="radio" id="normal-radio" v-model="mode" value="normal">
                <label for="drag-radio">拖拽</label>
                <input type="radio" id="drag-radio" v-model="mode" value="drag">
                <label for="edit-radio">编辑</label>
                <input type="radio" id="edit-radio" v-model="mode" value="edit">
                <label for="rotate-radio">旋转</label>
                <input type="radio" id="rotate-radio" v-model="mode" value="rotate">
                <label for="eraser-radio">橡皮擦</label>
                <input type="radio" id="eraser-radio" v-model="mode" value="erase">
                <label for="guidewireCheckbox">导线</label>
                <input id='guidewireCheckbox' v-model="guidewires" type='checkbox' checked/>
                <label for="checkbox">填充:</label>
                <input type="checkbox" id="checkbox" v-model="isFillColor">
                <input @click="erase" id='eraseAllButton' type='button' value='擦除所有'/>

            </li>
        </ul>
    </div>
</template>

<style scoped lang="scss">
    body {
        background: #eeeeee;
    }
    #controls {
        position: absolute;
        left: -25px;
        top: 0;
        display: flex;
        flex-wrap: wrap;
        list-style: none;
        align-items: center;
        li {
            display: flex;
            align-items: center;
            margin-right: 10px;
        }
    }
    #canvas {
        background: #ffffff;
        cursor: pointer;
        margin-left: 10px;
        margin-top: 10px;
        -webkit-box-shadow: 4px 4px 8px rgba(0,0,0,0.5);
        -moz-box-shadow: 4px 4px 8px rgba(0,0,0,0.5);
    }
</style>

<script>
    import { copyObj, drawGuidewires, drawGrid, windowToCanvas, saveDrawingSurface, restoreDrawingSurface } from "./appFunc";
    import { Circle, RoundRect, Polygon, Line, BezierCurve } from "./shape";
    import { Protractor } from './Protractor'
    import { Eraser } from './Eraser'

    export default {
        data() {
            return {
                eraserWidth: 25,
                eraserType: 'circle',
                shapes: [],
                sides: 3,
                startRadians: 0,
                shape: 'Line',
                isFillColor: false,
                ctx: null,
                canvas: null,
                guidewires: true,
                color: 'cornflowerblue',
                rubberbandLine: {
                    drawingSurfaceImageData: null,
                    mousedown: {},  // x,y
                    rubberbandRect: {}, // width, height, left, top
                    dragging: false,
                },
                mode: 'normal',
                selectedShape: null,
                draggingPoint: false, // End- or control point user is dragging
                rotatingLockEngaged: false,
                rotatingLockRadians: 0,
                rotatingShape: null,
                protractor: null,
                eraser: null
            }
        },
        mounted() {
            this.getContext();
            this.setCanvasSize();
            this.drawRubberbandLines();
            window.shapes = this.shapes;
        },
        watch: {
            mode() {
                let { canvas, mode } = this;
                switch (mode) {
                    case 'drag':
                    case 'edit':
                    case 'rotate':
                    case 'erase':
                        canvas.style.cursor = 'pointer';
                        break;
                    case 'normal':
                        canvas.style.cursor = 'crosshair';
                        break;
                }
                this.inactiveEditing();
                this.redraw();
            }
        },
        methods: {
            setCanvasSize() {
                let { canvas } = this;
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            },
            stopRotatingShape(loc) {
                let { selectedShape, rotatingLockRadians } = this;
                let radians = Math.atan((loc.y - selectedShape.y) /
                    (loc.x - selectedShape.x))
                    - rotatingLockRadians;
                selectedShape.startRadians += radians;
                selectedShape.isRotated = true;
                selectedShape.updatePointAfterRotated();
                this.rotatingShape = undefined;
                this.rotatingLockEngaged = false;
                this.rotatingLockRadians = 0;
                this.redraw();
            },
            saveCanvasInfo(loc) {
                let { rubberbandLine: { mousedown }, rubberbandLine, ctx, canvas } = this;
                rubberbandLine.drawingSurfaceImageData = saveDrawingSurface({ ctx, canvas });
                mousedown.x = loc.x;
                mousedown.y = loc.y;
                rubberbandLine.dragging = true;
            },
            drawShapes() {
                let { shapes } = this;
                shapes.forEach( shape => {
                    shape.draw();
                });
            },
            drawBezierCurve() {
                let { endPoints, controlPoints } = this.getEndAndControlPoints();
                let { ctx, shapes, rubberbandLine: { dragging }, color } = this;
                let curve = new BezierCurve({ ctx, strokeStyle: color, fillStyle: color, endPoints, controlPoints });
                curve.draw();
                if (!dragging) shapes.push(curve);
            },
            getEndAndControlPoints() {
                let endPoints = [ {}, {} ], // Endpoint locations (x, y)
                    controlPoints =  [ {}, {} ]; // Control point locations (x, y)
                let { rubberbandLine: { rubberbandRect } } = this;
                let { left, top, width, height } = rubberbandRect;
                endPoints[0].x = left;
                endPoints[0].y = top;
                endPoints[1].x = left + width;
                endPoints[1].y = top + height;
                controlPoints[0].x = left;
                controlPoints[0].y = top + height;
                controlPoints[1].x = left + width;
                controlPoints[1].y = top;
                return {
                    endPoints,
                    controlPoints
                }
            },
            drawPolygon() {
                let {
                    rubberbandLine: {
                        dragging,
                        rubberbandRect: {
                            width
                        },
                        mousedown: {
                            x,
                            y
                        }
                    },
                    ctx,
                    sides,
                    startRadians,
                    isFillColor,
                    color,
                    shapes
                } = this;
                let polygon = new Polygon({
                    centerX: x,
                    centerY: y,
                    radius: width,
                    sides,
                    startRadians,
                    strokeStyle: color,
                    fillStyle: color,
                    filled: isFillColor,
                    ctx
                });
                polygon.draw();
                if (!dragging) shapes.push(polygon);
            },
            getContext() {
                this.canvas = document.getElementById('canvas');
                this.ctx = this.canvas.getContext('2d');
            },
            erase() {
                let { ctx, canvas } = this;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawGrid({ ctx, color: 'lightblue', stepx: 10, stepy: 10 });
                saveDrawingSurface({ ctx, canvas });
            },
            drawRubberbandLines() {
                let { ctx, color } = this;
                ctx.strokeStyle = color;
                drawGrid({ ctx, color: 'lightblue', stepx: 10, stepy: 10 });
            },
            updateRubberbandRect({ loc }) {
                let {
                    rubberbandLine: {
                        rubberbandRect,
                        mousedown
                    },
                } = this;
                rubberbandRect.width = Math.abs(loc.x - mousedown.x);
                rubberbandRect.height = Math.abs(loc.y - mousedown.y);
                if (loc.x > mousedown.x) rubberbandRect.left = mousedown.x;
                else rubberbandRect.left = loc.x;
                if (loc.y > mousedown.y) rubberbandRect.top = mousedown.y;
                else rubberbandRect.top = loc.y;
            },
            drawRubberbandShape({ loc }) {
                let { shape } = this;
                this[`draw${ shape }`]({ loc });
            },
            drawRoundedRect({ cornerRadius = 10 } = {}) {
                let {
                    ctx,
                    color,
                    isFillColor,
                    shapes,
                    rubberbandLine: {
                        dragging,
                        rubberbandRect: { width, height },
                        mousedown: { x: cornerX, y: cornerY }
                    },
                } = this;
                let roundRect = new RoundRect({
                    ctx,
                    filled: isFillColor,
                    strokeStyle: color,
                    fillStyle: color,
                    width,
                    height,
                    cornerX,
                    cornerY,
                    cornerRadius
                });
                roundRect.draw();
                if (!dragging) shapes.push(roundRect);
            },
            drawCircle({ loc }) {
                let {
                    ctx,
                    rubberbandLine: {
                        dragging,
                        rubberbandRect: { width, height },
                        mousedown: {
                            x,
                            y
                        }
                    },
                    color,
                    isFillColor,
                    shapes
                } = this;
                let radius;
                if (y === loc.y) {
                    radius = Math.abs(loc.x - x);
                } else {
                    radius = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
                }
                let circle = new Circle({ centerX: x, centerY: y, radius, ctx, filled: isFillColor, strokeStyle: color, fillStyle: color });
                circle.draw();
                if (!dragging) shapes.push(circle);
            },
            drawLine({ loc }) {
                let {
                    ctx,
                    rubberbandLine: {
                        mousedown: {
                            x: beginX,
                            y: beginY
                        },
                        dragging
                    },
                    color,
                    shapes
                } = this;
                let { x: endX, y: endY } = loc;
                let line = new Line({ ctx, strokeStyle: color, fillStyle: color, beginX, beginY, endX, endY, filled: false });
                line.draw();
                if (!dragging) shapes.push(line);
            },
            updateRubberband({ loc }) {
                this.updateRubberbandRect({ loc });
                this.drawRubberbandShape({ loc });
            },
            inactiveEditing() {
                let { shapes } = this;
                shapes.forEach( shape => {
                    shape.isEditing = false;
                });
            },
            activeEditing({ shape }) {
                this.inactiveEditing();
                shape.isEditing = true;
            },
            getSelectedShape({ loc }) {
                let { shapes, ctx, mode } = this;
                for (let shape of shapes) {
                    let draggingPoint = shape.getDraggingPoint(loc);
                    shape.createPath();
                    if (ctx.isPointInPath(loc.x, loc.y) || (mode === 'edit' && draggingPoint)) {
                        this.selectedShape = shape;
                        switch (mode) {
                            case 'edit':
                                this.activeEditing({ shape });
                                this.redraw();
                                shape.savePointOffset(loc);
                                break;
                            case 'drag':
                                shape.savePointOffset(loc);
                                break;
                            case 'rotate':
                                this.rotatingShape = copyObj({ obj: shape, exclusiveKey: ['ctx'] });
                                break;
                        }
                        break;
                    } else {
                        this.selectedShape = null;
                        if (mode === 'edit') {
                            this.inactiveEditing();
                            this.redraw();
                        }
                    }
                }
            },
            initProtractor(loc) {
                let { ctx, rotatingLockRadians, rotatingLockEngaged } = this;
                let { rotatingShape } = this;
                if (this.rotatingShape) {
                    let protractor = new Protractor({ ctx, shape: rotatingShape, loc, rotatingLockRadians });
                    protractor.draw();

                    if (!rotatingLockEngaged) {
                        this.rotatingLockEngaged = true;
                        this.rotatingLockRadians = Math.atan((loc.y - rotatingShape.y) /
                            (loc.x - rotatingShape.x));
                    }
                    this.protractor = protractor;
                }
            },
            rotateShape(loc) {
                let { rotatingLockEngaged, rotatingLockRadians, protractor } = this;
                let {rotatingShape } = this;
                if (rotatingLockEngaged) {
                    let y = loc.y - rotatingShape.y;
                    let x = loc.x - rotatingShape.x;
                    let radians = Math.atan( y / x) - rotatingLockRadians;
                    if (x < 0 && y > 0 || x < 0 && y <= 0) {
                        radians = Math.PI + radians;
                    }
                    this.redraw();
                    rotatingShape.rotate(radians);
                    protractor.loc = loc;
                    protractor.draw();

                }
            },
            onMouseDown(e) {
                let {
                    canvas,
                    mode,
                    rotatingShape,
                    ctx,
                    eraser
                } = this;
                let { clientX: x, clientY: y } = e;
                let loc = windowToCanvas({ x, y, canvas });
                e.preventDefault(); // Prevent cursor change
                this.saveCanvasInfo(loc);
                switch (mode) {
                    case 'drag':
                        this.getSelectedShape({ loc });
                        break;
                    case 'edit':
                        this.getSelectedShape({ loc });
                        break;
                    case 'rotate':
                        if (rotatingShape) {
                            this.stopRotatingShape(loc);
                        } else {
                            this.getSelectedShape({ loc });
                            this.initProtractor(loc);
                        }
                        break;
                    case 'erase':
                        if (!eraser) {
                            let { eraserType, eraserWidth } = this;
                            this.eraser = new Eraser({ ctx, type: eraserType, width: eraserWidth });
                        }
                        break;
                }
                if (mode !== 'edit' && this.existEditingShap()) {
                    this.inactiveEditing();
                    this.redraw();
                }
            },
            existEditingShap() {
                let { shapes } = this;
                return shapes.some(shape => shape.isEditing);
            },
            onMouseMove(e) {
                let {
                    canvas,
                    ctx,
                    guidewires,
                    shape,
                    rubberbandLine: {
                        mousedown,
                        dragging,
                        drawingSurfaceImageData
                    },
                    mode,
                    selectedShape,
                    rotatingShape,
                    eraser
                } = this;
                let { clientX: x, clientY: y } = e;
                e.preventDefault(); // Prevent selections
                let loc = windowToCanvas({ x, y, canvas });
                if (dragging) {
                    switch (mode) {
                        case 'drag':
                            selectedShape && selectedShape.updatePointsOnMoving(loc);
                            break;
                        case 'edit':
                            selectedShape && selectedShape.draggingPoint && selectedShape.updatePointOnEditing(loc);
                            break;
                        case 'erase':
                            eraser.eraseLast({ x: mousedown.x, y: mousedown.y });
                            eraser.drawEraser(loc);
                            this.rubberbandLine.mousedown = loc;
                            break;
                        case 'normal':
                            restoreDrawingSurface({ ctx, imgData: drawingSurfaceImageData });
                            this.updateRubberband({ loc });
                            if(guidewires) {
                                let pos = shape === 'Line' ? loc : mousedown;
                                drawGuidewires({ ctx, x: pos.x, y: pos.y });
                            }
                            break;
                    }
                    if (mode === 'drag' || mode === 'edit') {
                        this.redraw();
                    }
                }
                if (mode === 'rotate') {
                    rotatingShape && this.rotateShape(loc);
                }
            },
            onMouseUp(e) {
                let {
                    ctx,
                    canvas,
                    rubberbandLine,
                    rubberbandLine: {
                        drawingSurfaceImageData,
                        mousedown
                    },
                    mode,
                    eraser,
                    selectedShape
                } = this;
                let { clientX: x, clientY: y } = e;
                let loc = windowToCanvas({ x, y, canvas });
                rubberbandLine.dragging = false;
                switch (mode) {
                    case 'normal':
                        restoreDrawingSurface({ ctx, imgData: drawingSurfaceImageData });
                        this.updateRubberband({ loc });
                        break;
                    case 'erase':
                        eraser.eraseLast(mousedown);
                        break;
                    case 'edit':
                    case 'drag':
                        if (selectedShape) {
                            let { type } = selectedShape;
                            switch (type) {
                                case 'BezierCurve':
                                    selectedShape.setCenter();
                                    break;
                            }
                        }
                        break;
                }
            },
            redraw() {
                let { ctx, canvas } = this;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawGrid({ ctx, color: 'lightblue', stepx: 10, stepy: 10 });
                this.drawShapes();
            }
        },
    }
</script>
