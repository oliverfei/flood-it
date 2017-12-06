var FastPriorityQueue = require("fastpriorityqueue");
const express = require('express');
const app = express();


class Node {
    constructor(parent, grid, action, numColors, cost, heuristic, depth, depthLimit) {
        this.action = action;
        this.numColors = numColors;
        this.parent = parent;
        this.grid = grid;
        this.cost = cost + heuristic(grid, numColors);
        this.heuristic = heuristic;
        this.depth = depth;
        this.depthLimit = depthLimit;
    }

    possibleActions() {
        var possibleActions = new Set();
        if (this.depthLimit == null || this.depth < this.depthLimit){
            for (var i = 0; i < this.numColors; i++)
                possibleActions.add(i);
            possibleActions.delete(this.grid[0][0]);
        }
        
        return possibleActions;
    }

    extractSolution() {
        var solution = [];
        var currentNode = this;
        while (currentNode.action != null) {
            solution.push(currentNode.action);
            currentNode = currentNode.parent;
        }
        solution = solution.reverse();
        console.log("Solution: " + JSON.stringify(solution));
        return solution;
    }

    expand() {
        var possibleNodes = [];
        for (let action of this.possibleActions()) {
            
            var newGrid = [];
            for (var i = 0; i < this.grid.length; i++){
                newGrid.push([]);
                for (var j = 0; j < this.grid.length; j++)
                    newGrid[i].push(this.grid[i][j]);
            }
            
            var seen = [];
            for (var j = 0; j < this.grid.length; j++){
                seen.push([]);
                for (var k = 0; k < this.grid.length; k++) {
                    seen[j].push(false);
                }
            }

            flood(0, 0, newGrid[0][0], action, newGrid, seen);
            var newNode = new Node(this, newGrid, action, this.numColors, this.cost + 1, this.heuristic, this.depth + 1, this.depthLimit);
            possibleNodes.push(newNode);
        }
        return possibleNodes;
    }

    isGoal() {
        var lastIndex = this.grid.length - 1;
        for (var i = lastIndex; i >= 0; i--)
            for (var j = lastIndex; j >= 0; j--)
                if (this.grid[0][0] != this.grid[i][j])
                    return false;
        return true;
    }

    toString() {
        var gridHash = "";
        for (var i = 0; i < this.grid.length; i++)
            for (var j = 0; j < this.grid.length; j++)
                gridHash += "" + this.grid[i][j];
        return gridHash;
    }
}

function flood(i, j, original, replace, grid, seen) {
    var size = grid.length;
    if(i < 0 || j < 0 || i >= size || j >= size || seen[i][j]) {
        return 0;
    }
    seen[i][j] = true;
    if (grid[i][j] === original) {
        grid[i][j] = replace;
        return 1 + flood(i, j + 1, original, replace, grid, seen) +
            flood(i, j - 1, original, replace, grid, seen) +
            flood(i + 1, j, original, replace, grid, seen) +
            flood(i - 1, j, original, replace, grid, seen);
    }
    return 0;
}

// Number of remaining colors
function heuristic1(grid, numColors) {
    var visitedColors = new Set();
    var lastIndex = grid.length - 1;
    for (var i = lastIndex; i >= 0; i--)
        for (var j = lastIndex; j >= 0; j--) {
            visitedColors.add(grid[i][j]);
            if (visitedColors.size === numColors)
                return numColors - 1;
        }
    return visitedColors.size - 1;
}

// Max betweem total remaining colors and
// Colour changes in 2x2 neighbourhoods along top-left to bottom-right diagonal:
// ##___
// ###__
// _###_
// __###
// ___##
function heuristic2(grid, numColors) {
    var colorChanges = 0;
    var x = 0;
    var y = 0;
    var lastIndex = grid.length - 1;
    var moveSequence = [[1,0],[0,1],[-1,0],[0,-1]];
    
    var prevColor = 0;
    while (x < lastIndex && y < lastIndex) {
        prevColor = grid[x][y];
        for (var i = 0; i < 4; i++) {
            x += moveSequence[i][0];
            y += moveSequence[i][1];
            var currentColor = grid[x][y];
            if (prevColor != currentColor)
                colorChanges += 1;
            prevColor = currentColor;
        }
        // move to next 2x2 region
        x += 1;
        y += 1;
    }

    colorChanges = Math.floor(colorChanges * numColors / 10);

    return Math.max(heuristic1(grid, numColors), colorChanges);
}

function aStarSearch(node) {
    var start = Date.now();
    var nodesVisited = 0;
    var pq = new FastPriorityQueue(function(a,b) {return a.cost < b.cost});
    pq.add(node);
    
    var currentNode = pq.poll();
    var visited = new Set();
    var goalReached = currentNode.isGoal();
    while (!goalReached) {
        var nodeHash = currentNode.toString();
        if (!visited.has(nodeHash)) {
            visited.add(nodeHash);
            nodesVisited += 1;
            var newNodes = currentNode.expand();
            for (var i = 0; i < newNodes.length; i++) {
                pq.add(newNodes[i]);
            }
        }

        if (pq.size === 0) {
            return [];
        }
        currentNode = pq.poll();
        console.log(currentNode.grid);
        goalReached = currentNode.isGoal();
    }
    var end = Date.now();
    console.log("Nodes visited: " + nodesVisited);
    console.log("Run time (ms): " + (end - start));
    return currentNode.extractSolution();
}

app.engine('html', require('ejs').renderFile);
app.use(express.static('public'));

app.get('/', (req, res) => res.render("index.html"));

app.post('/', function(req,res){
    var data = "";
    req.on('data', function (chunk) {
        data += chunk;
    });
    req.on('end', function () {
        var dataObj = JSON.parse(data);
        var neighborColors = new Set();
        console.log(dataObj.grid);
        console.log(dataObj.numColors);

        var heuristicFunction = heuristic1;
        var depthLimit = null;
        if (dataObj.heuristic === 2) {
            depthLimit = parseInt(dataObj.greedyDepth);
            heuristicFunction = heuristic2;
        }
            

        var root = new Node(null, dataObj.grid, null, parseInt(dataObj.numColors), 0, heuristicFunction, 0, depthLimit);
        
        console.log("Starting astarSearch...");
        var solution = aStarSearch(root);
        res.send(solution);
    })
});

app.listen(3000, () => console.log('Example app listening on port 3000!'));