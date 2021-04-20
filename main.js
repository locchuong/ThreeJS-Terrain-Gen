// Require packages
var THREE = require('three');
var DAT = require('dat.gui');
var Stats = require('stats-js');
var OrbitControls = require('three-orbitcontrols');
var noise = require('open-simplex-noise');
var worleyNoise = require('worley-noise');

// ThreeJS variables
var camera, scene, renderer;
var axesHelper; // 3D Axis helper
var geometry, material, mesh; // Terrain vars
var wireframe, line; // Terrain wireframe vars

// Stats tracker
var stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Noise functions
var noise2D = new noise.makeNoise2D(Date.now());
var worley = new worleyNoise({
    numPoints: 10,
    seed: Date.now()
});

var img = worley.renderImage(100, {normalize: true});
console.log(img);

// GUI params
var params = {
    noiseFunc: 'OpenSimplex',
    // Noise Vars
    maxHeight: 6,
    // Open Simplex Vars
    xoff: 0.2,
    yoff: 0.2,
    // Worley Vars
    worleyPts: 10,
    manhattan: false,
    // Geom Vrs
    segments: 100,
    steps: 1,
    xsize: 50,
    ysize: 50,
    color: '#00ff00',
    // Toggles
    wireframe: false,
    axes: false,
    reset: function () {
        noise2D = new noise.makeNoise2D(Date.now());
        worley = new worleyNoise({
            numPoints: params.worleyPts,
            seed: Date.now()
        });
        rerenderGeom();
    }
};

init(); //Initalize ThreeJS objects
initGui(); //Initalize GUI
animate(); // Animate ThreeJS objects

// Initalize GUI
function initGui() {
    var gui = new DAT.GUI({
        height: 5 * 32 - 1
    });

    // Noise variables
    var nVars = gui.addFolder('Noise Variables');
    nVars.open();
    nVars.add(params, 'noiseFunc', {OpenSimplex:'OpenSimplex', Worley:'Worley'}).onFinishChange(function(newVal) {
        openSimplexVars.hide();
        worleyVars.hide();
        switch(newVal) {
            case 'OpenSimplex':
                openSimplexVars.show();
                break;
            case 'Worley':
                worleyVars.show();
                break;
        }
        rerenderGeom();
    });
    nVars.add(params, 'maxHeight').min(1).max(50).step(2).onFinishChange(rerenderGeom);

    var openSimplexVars = nVars.addFolder('OpenSimplex Variables');
    openSimplexVars.add(params, 'xoff').min(0).max(1).step(.1).onFinishChange(rerenderGeom);
    openSimplexVars.add(params, 'yoff').min(0).max(1).step(.1).onFinishChange(rerenderGeom);

    var worleyVars = nVars.addFolder('Worley Variables');
    worleyVars.hide();
    worleyVars.add(params, 'manhattan').name('manhattan dist').onFinishChange(rerenderGeom);
    worleyVars.add(params, 'worleyPts').min(1).max(20).step(1).onFinishChange(function() {
        worley = new worleyNoise({
            numPoints: params.worleyPts,
            seed: Date.now()
        });
        rerenderGeom();
    });
    
    // Geometry Variables
    var geomVars = gui.addFolder('Geometry variables');
    geomVars.open();
    geomVars.add(params, 'segments').min(1).max(300).step(1).onFinishChange(rerenderGeom);
    geomVars.add(params, 'steps').min(1).max(50).step(1).onFinishChange(rerenderGeom);
    geomVars.add(params, 'xsize').min(1).max(200).step(1).onFinishChange(rerenderGeom);
    geomVars.add(params, 'ysize').min(1).max(200).step(1).onFinishChange(rerenderGeom);
    geomVars.addColor(params, 'color').onFinishChange(rerenderGeom);

    // Checkboxes/Modes
    gui.add(params, 'wireframe').onFinishChange(rerenderGeom);
    gui.add(params, 'axes').listen().onChange(function() {
        if(!params.axes) {
            scene.remove(axesHelper);
        }
        else {
            let max = Math.max(params.xsize, params.ysize);
            axesHelper = new THREE.AxesHelper(max/2 + 5);
            scene.add(axesHelper);
        }
    });
    gui.add(params, 'reset');
}

// Renders terrain using parameters from gui
function rerenderGeom() {
    // Remove geometries from scene
    if(mesh) {
        scene.remove(mesh);
        geometry.dispose();
        material.dispose();
    }
    if(line) {
        scene.remove(line);
        wireframe.dispose();
    }

    //let max = 0;
    //let min = 300;

    // Create Plane Geometry
    geometry = new THREE.PlaneGeometry(params.xsize, params.ysize, params.segments, params.segments);
    for (let i = 0; i < geometry.vertices.length; i++) {
        switch(params.noiseFunc) {
            case 'OpenSimplex':
                geometry.vertices[i].z = params.maxHeight * dither((noise2D(geometry.vertices[i].x * params.xoff, geometry.vertices[i].y * params.yoff) + 1)/2, params.steps);
                break;
            case 'Worley':
                if(params.manhattan) {
                    geometry.vertices[i].z = params.maxHeight * dither(worley.getManhattan({x:(geometry.vertices[i].x+(params.xsize/2))/params.xsize, y:(geometry.vertices[i].y+(params.ysize/2))/params.ysize}, 1), params.steps);
                }
                else {
                    geometry.vertices[i].z = params.maxHeight * dither(worley.getEuclidean({x:(geometry.vertices[i].x+(params.xsize/2))/params.xsize, y:(geometry.vertices[i].y+(params.ysize/2))/params.ysize}, 1), params.steps);
                }
                break;
            default:
                geometry.vectices[i].z = 0;
        }
        //if(geometry.vertices[i].z > max) max = geometry.vertices[i].z;
        //if(geometry.vertices[i].z < min) min = geometry.vertices[i].z;
    }
    geometry.rotateX(-Math.PI / 2);
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    //console.log("max:" + max);
    //console.log("min:" + min);

    // Handles wireframe mode
    if (params.wireframe) {
        wireframe = new THREE.WireframeGeometry(geometry);
        line = new THREE.LineSegments(wireframe);
        line.material.depthTest = false;
        line.material.opacity = 0.25;
        line.material.transparent = true;
        scene.add(line);
        return;
    }

    // Wireframe mode off, add Plane Geometry to scene
    material = new THREE.MeshPhongMaterial({
        side: THREE.DoubleSide,
        color: params.color,
    });
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

}

// Initialize ThreeJS objects and initial Scene
function init() {

    // Initalize perspective camera, set camera z pos
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.y = 25;
    camera.position.z = 40;
    camera.lookAt(0,0);

    // Initalize scene
    scene = new THREE.Scene();
    rerenderGeom();

    // Initialize Light
    var light = new THREE.PointLight(0xffffff, 1, 200);
    light.castShadow = true;
    light.position.set(0, 40, 30);
    scene.add(light);

    var pointLightHelper = new THREE.PointLightHelper(light, 1 / 4);
    scene.add(pointLightHelper);

    // Initalize WebGLRenderer
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Handle window size when resized
    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    // Orbit Control
    controls = new OrbitControls(camera, renderer.domElement);

    document.body.appendChild(renderer.domElement);
}

// Animation loop
function animate() {
    stats.begin();
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    stats.end();
}

// Step function [0,1] with ditherLevel many steps
function dither(c, ditherLevel) {
    if(ditherLevel === 1) return c;
    let c0 = (1.0/(ditherLevel-1))* Math.floor(c*(ditherLevel-1.0));
    let c1 = c0 + 1.0/(ditherLevel-1.0);
    if( (c1-c) <= (c-c0)) {
        return c1;
    }
    else {
        return c0;
    }
}