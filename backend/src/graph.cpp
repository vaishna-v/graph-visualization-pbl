#include "graph.h"
#include <iostream>
#include <fstream>
#include <stdexcept>

Graph::Graph() : name("Untitled Graph") {}

Graph::Graph(const string& graphName) : name(graphName) {}

void Graph::addNode(int id, double x, double y) {
    // Check if node already exists
    for (const auto& node : nodes) {
        if (node.id == id) {
            // Node exists, update position if needed
            if (x != 0.0 || y != 0.0) {
                for (auto& n : nodes) {
                    if (n.id == id) {
                        n.x = x;
                        n.y = y;
                        break;
                    }
                }
            }
            return;
        }
    }
    
    // Add new node
    nodes.push_back({id, x, y});
    adjacencyList[id] = vector<pair<int, int>>();
}

void Graph::addEdge(int from, int to, int weight) {
    // Ensure both nodes exist
    addNode(from);
    addNode(to);
    
    // Check if edge already exists
    for (auto& neighbor : adjacencyList[from]) {
        if (neighbor.first == to) {
            neighbor.second = weight; // Update weight if edge exists
            edgeWeights[from][to] = weight;
            return;
        }
    }
    
    // Add new edge
    adjacencyList[from].push_back({to, weight});
    adjacencyList[to].push_back({from, weight}); // Undirected graph
    edgeWeights[from][to] = weight;
    edgeWeights[to][from] = weight;
}

void Graph::removeEdge(int from, int to) {
    // Remove from adjacency list (from -> to)
    auto& neighborsFrom = adjacencyList[from];
    for (auto it = neighborsFrom.begin(); it != neighborsFrom.end(); ++it) {
        if (it->first == to) {
            neighborsFrom.erase(it);
            break;
        }
    }
    
    // Remove from adjacency list (to -> from)
    auto& neighborsTo = adjacencyList[to];
    for (auto it = neighborsTo.begin(); it != neighborsTo.end(); ++it) {
        if (it->first == from) {
            neighborsTo.erase(it);
            break;
        }
    }
    
    // Remove from edge weights map
    edgeWeights[from].erase(to);
    edgeWeights[to].erase(from);
}

const vector<Node>& Graph::getNodes() const {
    return nodes;
}

const vector<pair<int, int>> Graph::getNeighbors(int node) const {
    auto it = adjacencyList.find(node);
    if (it != adjacencyList.end()) {
        return it->second;
    }
    return vector<pair<int, int>>();
}

int Graph::getEdgeWeight(int from, int to) const {
    auto fromIt = edgeWeights.find(from);
    if (fromIt != edgeWeights.end()) {
        auto toIt = fromIt->second.find(to);
        if (toIt != fromIt->second.end()) {
            return toIt->second;
        }
    }
    return -1; // Indicate no edge exists
}

bool Graph::hasEdge(int from, int to) const {
    return getEdgeWeight(from, to) != -1;
}

int Graph::getNodeCount() const {
    return nodes.size();
}

int Graph::getEdgeCount() const {
    int count = 0;
    for (const auto& pair : adjacencyList) {
        count += pair.second.size();
    }
    return count / 2; // Divide by 2 for undirected graph
}

void Graph::setName(const string& newName) {
    name = newName;
}

const string& Graph::getName() const {
    return name;
}

void Graph::setNodePosition(int nodeId, double x, double y) {
    for (auto& node : nodes) {
        if (node.id == nodeId) {
            node.x = x;
            node.y = y;
            return;
        }
    }
    // If node doesn't exist, create it
    addNode(nodeId, x, y);
}

Node Graph::getNode(int nodeId) const {
    for (const auto& node : nodes) {
        if (node.id == nodeId) {
            return node;
        }
    }
    throw out_of_range("Node with ID " + to_string(nodeId) + " not found");
}

json Graph::toJson() const {
    json j;
    j["name"] = name;
    
    // Serialize nodes
    json nodesArray = json::array();
    for (const auto& node : nodes) {
        json nodeJson;
        nodeJson["id"] = node.id;
        nodeJson["x"] = node.x;
        nodeJson["y"] = node.y;
        nodesArray.push_back(nodeJson);
    }
    j["nodes"] = nodesArray;
    
    // Serialize edges
    json edgesArray = json::array();
    // Use edgeWeights to avoid duplicates in undirected graph
    unordered_map<int, unordered_map<int, bool>> addedEdges;
    
    for (const auto& fromPair : edgeWeights) {
        int from = fromPair.first;
        for (const auto& toPair : fromPair.second) {
            int to = toPair.first;
            int weight = toPair.second;
            
            // Add each edge only once
            if (!addedEdges[from][to] && !addedEdges[to][from]) {
                json edgeJson;
                edgeJson["from"] = from;
                edgeJson["to"] = to;
                edgeJson["weight"] = weight;
                edgesArray.push_back(edgeJson);
                addedEdges[from][to] = true;
            }
        }
    }
    j["edges"] = edgesArray;
    
    return j;
}

void Graph::fromJson(const json& j) {
    clear();
    
    if (j.contains("name")) {
        name = j["name"];
    }
    
    // Deserialize nodes
    if (j.contains("nodes") && j["nodes"].is_array()) {
        for (const auto& nodeJson : j["nodes"]) {
            int id = nodeJson["id"];
            double x = nodeJson.value("x", 0.0);
            double y = nodeJson.value("y", 0.0);
            addNode(id, x, y);
        }
    }
    
    // Deserialize edges
    if (j.contains("edges") && j["edges"].is_array()) {
        for (const auto& edgeJson : j["edges"]) {
            int from = edgeJson["from"];
            int to = edgeJson["to"];
            int weight = edgeJson["weight"];
            addEdge(from, to, weight);
        }
    }
}

bool Graph::writeToFile(const string& filepath) const {
    try {
        ofstream file(filepath);
        if (!file.is_open()) {
            return false;
        }
        
        json j = toJson();
        file << j.dump(4); // Pretty print with 4 spaces indentation
        file.close();
        return true;
    } catch (const exception& e) {
        cerr << "Error writing graph to file: " << e.what() << endl;
        return false;
    }
}

bool Graph::readFromFile(const string& filepath) {
    try {
        ifstream file(filepath);
        if (!file.is_open()) {
            return false;
        }
        
        json j;
        file >> j;
        file.close();
        
        fromJson(j);
        return true;
    } catch (const exception& e) {
        cerr << "Error reading graph from file: " << e.what() << endl;
        return false;
    }
}

void Graph::clear() {
    name = "Untitled Graph";
    nodes.clear();
    adjacencyList.clear();
    edgeWeights.clear();
}

bool Graph::isEmpty() const {
    return nodes.empty();
}