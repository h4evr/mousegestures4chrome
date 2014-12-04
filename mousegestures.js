var Gestures = (function () {

    function uniqBy(attr, points) {
        var lastValue = null;

        return points.map(function (obj, index) {
            var p = obj[attr];

            if (index === 0 || p !== lastValue) {
                lastValue = p;
                return obj;
            } else {
                return null;
            }
        }).filter(function (v) {
            return v !== null;
        });
    }

    function get(attr, points) {
        return points.map(function (p) {
            return p[attr];
        });
    }

    function normalizePoint(min, size) {
        return function (point) {
            return size === 0 ? 0 : (point - min) / size;
        };
    }

    function normalize(min, size, points) {
        return points.map(normalizePoint(min, size));
    }

    function reducePoints(fn, points) {
        return points.reduce(function (current, point) {
            return fn(point, current);
        });
    }

    function quantize(resolution) {
        return function (points) {
            return points.map(function (point) {
                return Math.floor(point * resolution);
            });
        };
    }

    function diff(points, threshold) {
        var diffs = points.map(function (p, index) {
                if (index === 0) {
                    return null;
                } else {
                    var val = p.value - points[index - 1].value;

                    return {
                        index: p.index,
                        value: val > threshold || val < -threshold ? val : 0
                    };
                }
            });
        diffs.shift();
        return diffs;
    }

    function translateDiff(neg, pos) {
        return function (track) {
            return track.map(function (p) {
                var d = p.value;

                if (d === 0) {
                    return null;
                } else if (d < 0) {
                    return {
                        index: p.index,
                        value: neg
                    };
                } else {
                    return {
                        index: p.index,
                        value: pos
                    };
                }
            }).filter(function (p) {
                return p !== null;
            });
        };
    }

    function splitTrack(attr, points) {
        return points.map(function (p) {
            return p[attr];
        });
    }

    function addOrder(points) {
        return points.map(function (p, i) {
            return {
                value: p,
                index: i
            };
        });
    }

    function mergeMotions(xMotions, yMotions) {
        var res = xMotions.map(function (x, i) {
            return {
                index: x.index,
                value: x.value,
                axis: 'x'
            };
        });

        res = res.concat(yMotions.map(function (y, i) {
            return {
                index: y.index,
                value: y.value,
                axis: 'y'
            };
        }));

        return get('value', uniqBy('value', res.sort(function (a, b) {
            if (a.index < b.index) {
                return -1;
            } else if (a.index > b.index) {
                return 1;
            } else if (a.axis === b.axis) {
                return 0;
            } else if (a.axis === 'x') {
                return -1;
            } else {
                return 1;
            }
        }))).join("");
    }

    var toGrid = quantize(8),
        xTranslator = translateDiff('L', 'R'),
        yTranslator = translateDiff('U', 'D');

    function getGesture(points, threshold) {
        if (!points || points.length < 2) {
            return "";
        }

        var x = splitTrack('x', points),
            y = splitTrack('y', points),
            minX = reducePoints(Math.min, x),
            maxX = reducePoints(Math.max, x),
            minY = reducePoints(Math.min, y),
            maxY = reducePoints(Math.max, y),
            maxSize = Math.max(maxX - minX, maxY - minY),
            xTrack = uniqBy('value', addOrder(toGrid(normalize(minX, maxSize, x)))),
            yTrack = uniqBy('value', addOrder(toGrid(normalize(minY, maxSize, y)))),
            xMotions = xTranslator(diff(xTrack, 1)),
            yMotions = yTranslator(diff(yTrack, 1));

        return mergeMotions(xMotions, yMotions);
    }

    return {
        getGesture: getGesture
    };
}());

/* Trail implementation */
var GesturesTrail = (function () {
    var trailCanvas,
        points = [];

    var getCanvas = function () {
        if (!trailCanvas) {
            trailCanvas = document.createElement("canvas");
            trailCanvas.setAttribute("id", "__gesture_trail_canvas");
            trailCanvas.width = 0;
            trailCanvas.height = 0;
            trailCanvas.style.backgroundColor = "transparent";
            trailCanvas.style.zIndex = 9999;
            trailCanvas.style.position = "fixed";
            trailCanvas.style.left = "0";
            trailCanvas.style.top = "0";
        }

        return trailCanvas;
    };

    var renderTrail = function () {
        if (points.length === 0) {
            return;
        }

        var context = trailCanvas.getContext('2d');
	    context.strokeStyle = '#f00';
	    context.lineWidth = 4;

	    context.beginPath();
	    context.moveTo(points[0].x, points[0].y);
	    for (var i = 1, len = points.length; i < len; ++i) {
	        context.lineTo(points[i].x, points[i].y);
	    }
	    context.stroke();
	    context.closePath();
    };

    var startTrail = function (x, y) {
        var canvas = getCanvas();

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        if (!canvas.parentNode) {
            document.body.appendChild(canvas);
        }

        points = [];
    };

    var addPointToTrail = function (x, y) {
        points.push({
            x: x,
            y: y
        });

	    window.requestAnimationFrame(renderTrail);
    };

    var stopTrail = function () {
        points = [];

        if (trailCanvas.parentNode) {
            trailCanvas.parentNode.removeChild(trailCanvas);
        }
    };

    return {
        startTrail: startTrail,
        addPointToTrail: addPointToTrail,
        stopTrail: stopTrail
    };
}());

var emptyFn = function() {},
    NoGesturesTrail = {
        startTrail: emptyFn,
        addPointToTrail: emptyFn,
        stopTrail: emptyFn
    };

var GesturesApp = (function () {
    var points = [],
        configs,
        lastClick,
        lastLeftPress;

    var throttle = function (fn, ms) {
        var lastInvocation;
        return function () {
            var now = new Date().getTime();

            if (!lastInvocation || now - lastInvocation > ms) {
                lastInvocation = now;
                return fn.apply(this, arguments);
            }
        };
    };

    var fireAction = function (gesture) {
        if (configs.mappings.hasOwnProperty(gesture)) {
          chrome.runtime.sendMessage(null, {
            "action": configs.mappings[gesture]
          });
        }
    };

    var onMouseMove = throttle(function (e) {
        lastClick = null;
        lastLeftPress = null;
        points.push({
            x: e.x,
            y: e.y
        });

        Gestures.trail.addPointToTrail(e.x, e.y);
    }, 100);

    var onLeftButtonDown = function (e) {
        if (e.button !== 0) {
            return;
        }

        var now = new Date().getTime();

        if (lastClick && now - lastClick <= configs.rockerInterval) {
            lastClick = null;
            lastLeftPress = null;
            fireAction("rockerleft");
            e.preventDefault();
        } else {
            lastLeftPress = now;
        }
    };

    var onMouseDown = function (e) {
        var now = new Date().getTime();

        if (lastLeftPress && now - lastLeftPress <= configs.rockerInterval) {
            lastClick = null;
            lastLeftPress = null;
            fireAction("rockerright");
            e.preventDefault();
        } else if (!lastClick || now - lastClick > configs.doubleClickInterval) {
            lastClick = now;
            lastLeftPress = null;
            points = [];
            document.addEventListener('mousemove', onMouseMove, false);
            document.addEventListener('mouseup', onMouseUp, false);
            Gestures.trail.startTrail(e.x, e.y);
            e.preventDefault();
        } else {
            lastLeftPress = null;
            lastClick = null;
            // and don't cancel event
        }
    };

    var onMouseUp = function () {
        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mouseup', onMouseUp, false);

        var gesture = Gestures.getGesture(points, 0);

        Gestures.trail.stopTrail();

        if (gesture) {
            fireAction(gesture);
        }

        points = null;
    };

    var init = function () {
        Gestures.trail = configs.showTrail ? GesturesTrail : NoGesturesTrail;

        document.addEventListener('mousedown', onLeftButtonDown, false);
        document.addEventListener('contextmenu', onMouseDown, false);
    };

    chrome.runtime.sendMessage(null, {'getConfigs': true}, function (cfgs) {
      console.log("Got configs: ", cfgs);
      configs = cfgs;
      init();
    });
}());