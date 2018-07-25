let canvas = document.getElementById('canvas'),
    context = canvas.getContext('2d'),
    eraseAllButton = document.getElementById('eraseAllButton'),
    strokeStyleSelect = document.getElementById('strokeStyleSelect'),
    guidewireCheckbox = document.getElementById('guidewireCheckbox'),
    fillCheckbox = document.getElementById('fillCheckbox'),
    editCheckbox = document.getElementById('editCheckbox'), 
    // 多边形 start
    sidesSelect = document.getElementById('sidesNumber'),
    startAngleSelect = document.getElementById('startAngle'),
    Point = function (x, y) {
        this.x = x;
        this.y = y;
    },
    // 多边形 end
    drawingSurfaceImageData,
    mousedown = {},
    rubberbandRect = {},
    dragging = false,
    draggingOffsetX,
    draggingOffsetY,

    editing = false,
    polygons = [],
    guidewires = guidewireCheckbox.checked;
// Functions..........................................................
function drawGrid(color, stepx, stepy) {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = 0.5;
    for (let i = stepx + 0.5; i < context.canvas.width; i += stepx) {
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, context.canvas.height);
        context.stroke();
    }
    for (let i = stepy + 0.5; i < context.canvas.height; i += stepy) {
        context.beginPath();
        context.moveTo(0, i);
        context.lineTo(context.canvas.width, i);
        context.stroke();
    }
    context.restore();
}
function windowToCanvas(x, y) {
    let bbox = canvas.getBoundingClientRect();
    return { x: x - bbox.left * (canvas.width / bbox.width),
        y: y - bbox.top * (canvas.height / bbox.height) };
}
// Save and restore drawing surface...................................
function saveDrawingSurface() {
    drawingSurfaceImageData = context.getImageData(0, 0,
        canvas.width,
        canvas.height);
}
function restoreDrawingSurface() {
    context.putImageData(drawingSurfaceImageData, 0, 0);
}
// Rubber bands.......................................................
function updateRubberbandRectangle(loc) {
    rubberbandRect.width = Math.abs(loc.x - mousedown.x);
    rubberbandRect.height = Math.abs(loc.y - mousedown.y);
    rubberbandRect.left = Math.min(mousedown.x, loc.x);
    rubberbandRect.top = Math.min(mousedown.y, loc.y);
}
function drawLine(loc) {
    context.beginPath();
    context.moveTo(mousedown.x, mousedown.y);
    context.lineTo(loc.x, loc.y);
    context.stroke();
}
function drawCircle(loc) {
    let angle,
        radius;
    if (mousedown.y === loc.y) { // Horizontal line
        radius = Math.abs(loc.x - mousedown.x);
    }
    else {
        /*
        angle = Math.atan(rubberbandRect.height/rubberbandRect.width),
            radius = rubberbandRect.height / Math.sin(angle);
            */
        let {height, width} = rubberbandRect;
        radius = Math.sqrt(height * height + width * width);
    }
    context.beginPath();
    context.arc(mousedown.x, mousedown.y, radius, 0, Math.PI*2, false);
    context.stroke();
    if (fillCheckbox.checked) {
        context.fill(); 
    }
}
function drawRubberbandShape(loc) {
    // 画圆
    // drawCircle(loc);
    // 画多边形
    drawPolygon();
}
function updateRubberband(loc) {
    updateRubberbandRectangle(loc);
    drawRubberbandShape(loc);
}
// Polygon.........................................................
class Polygon {
    constructor(
        centerX,
        centerY,
        radius,
        sides,
        startAngle,
        strokeStyle,
        fillStyle,
        filled 
    ) {
        this.x = centerX;
        this.y = centerY;
        this.radius = radius;
        this.sides = sides;
        this.startAngle = startAngle;
        this.strokeStyle = strokeStyle;
        this.fillStyle = fillStyle;
        this.filled = filled; 
    }
    getPoints() {
        var points = [],
            angle = this.startAngle || 0;
        for (var i=0; i < this.sides; ++i) {
            points.push(new Point(this.x + this.radius * Math.sin(angle),
                this.y - this.radius * Math.cos(angle)));
            angle += 2*Math.PI/this.sides;
        }
        return points;
    }
    createPath(context) {
        var points = this.getPoints();
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (var i=1; i < this.sides; ++i) {
            context.lineTo(points[i].x, points[i].y);
        }
        context.closePath();
    }
    stroke(context) {
        context.save();
        this.createPath(context);
        context.strokeStyle = this.strokeStyle;
        context.stroke();
        context.restore();
    }
    fill(context) {
        context.save();
        this.createPath(context);
        context.fillStyle = this.fillStyle;
        context.fill();
        context.restore();
    }
    move(x, y) {
        this.x = x;
        this.y = y;
    }
}

function drawPolygon() {
    let {height, width} = rubberbandRect;
    radius = Math.sqrt(height * height + width * width);
    var polygon = new Polygon(
        mousedown.x,
        mousedown.y,
        radius,
        parseInt(sidesSelect.value),
        (Math.PI / 180) * parseInt(startAngleSelect.value),
        context.strokeStyle,
        context.fillStyle,
        fillCheckbox.checked);

    drawOnePolygon(polygon);

    if (!dragging) {
        polygons.push(polygon);
    }
}

function drawOnePolygon(polygon) {
    context.beginPath();
    polygon.createPath(context);
    polygon.stroke(context);
    if (fillCheckbox.checked) {
        polygon.fill(context);
    }
}

function drawStoredPolygons() {
    polygons.forEach( function (polygon) {
        drawPolygon(polygon);
    });
}

// Dragging...........................................................
function startDragging(loc) {
    saveDrawingSurface();
    mousedown.x = loc.x;
    mousedown.y = loc.y;
}
function startEditing() {
    canvas.style.cursor = 'pointer';
    editing = true;
}
function stopEditing() {
    canvas.style.cursor = 'crosshair';
    editing = false;
}

// Guidewires.........................................................
function drawHorizontalLine (y) {
    context.beginPath();
    context.moveTo(0,y+0.5);
    context.lineTo(context.canvas.width, y+0.5);
    context.stroke();
}
function drawVerticalLine (x) {
    context.beginPath();
    context.moveTo(x+0.5,0);
    context.lineTo(x+0.5, context.canvas.height);
    context.stroke();
}
function drawGuidewires(x, y) {
    context.save();
    context.strokeStyle = 'rgba(0,0,230,0.4)';
    context.lineWidth = 0.5;
    drawVerticalLine(x);
    drawHorizontalLine(y);
    context.restore();
}
// Canvas event handlers..............................................
// 画圆和直线
/*
canvas.onmousedown = function (e) {
    let loc = windowToCanvas(e.clientX, e.clientY);
    e.preventDefault(); // Prevent cursor change
    saveDrawingSurface();
    mousedown.x = loc.x;
    mousedown.y = loc.y;
    dragging = true;

};
canvas.onmousemove = function (e) {
    let loc;
    if (dragging) {
        e.preventDefault(); // Prevent selections
        loc = windowToCanvas(e.clientX, e.clientY);
        restoreDrawingSurface();
        updateRubberband(loc);
        if(guidewires) {
            drawGuidewires(loc.x, loc.y);
        }
    }
};
canvas.onmouseup = function (e) {
    loc = windowToCanvas(e.clientX, e.clientY);
    restoreDrawingSurface();
    updateRubberband(loc);
    dragging = false;
};
*/

canvas.onmousedown = function (e) {
    var loc = windowToCanvas(e.clientX, e.clientY);
    e.preventDefault(); // Prevent cursor change
    if (editing) {
        polygons.forEach( function (polygon) {
            polygon.createPath(context);
            if (context.isPointInPath(loc.x, loc.y)) {
                startDragging(loc);
                dragging = polygon;
                draggingOffsetX = loc.x - polygon.x;
                draggingOffsetY = loc.y - polygon.y;
                return;
            }
        });
    }
    else {
        startDragging(loc);
        dragging = true;
    }
};
canvas.onmousemove = function (e) {
    var loc = windowToCanvas(e.clientX, e.clientY);
    e.preventDefault(); // Prevent selections
    if (editing && dragging) {
        dragging.x = loc.x - draggingOffsetX;
        dragging.y = loc.y - draggingOffsetY;
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid('lightgray', 10, 10);
        drawStoredPolygons();
    }
    else {
        if (dragging) {
            restoreDrawingSurface();
            updateRubberband(loc);
            if (guidewires) {
                drawGuidewires(mousedown.x, mousedown.y);
            }
        }
    }
};

canvas.onmouseup = function (e) {
    var loc = windowToCanvas(e.clientX, e.clientY);
    dragging = false;
    if (editing) {
    }
    else {
        restoreDrawingSurface();
        updateRubberband(loc);
    }
};
// Controls event handlers.......................................
eraseAllButton.onclick = function (e) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid('lightgray', 10, 10); 
    saveDrawingSurface();
};
strokeStyleSelect.onchange = function (e) {
    context.fillStyle = context.strokeStyle = strokeStyleSelect.value;
};
/*
fillStyleSelect.onchange = function (e) {
    context.fillStyle = fillStyleSelect.value;
};
*/
editCheckbox.onchange = function (e) {
    if (editCheckbox.checked) {
        startEditing();
    }
    else {
        stopEditing();
    }
};
guidewireCheckbox.onchange = function (e) {
    guidewires = guidewireCheckbox.checked;
};
// Initialization................................................
context.strokeStyle = strokeStyleSelect.value;
// context.fillStyle = fillStyleSelect.value;
context.shadowColor = 'rgba(0,0,0,0.4)';
context.shadowOffsetX = 2;
context.shadowOffsetY = 2;
context.shadowBlur = 4;
drawGrid('lightgray', 10, 10);

