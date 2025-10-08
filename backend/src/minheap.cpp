#include "minheap.h"

MinHeap::MinHeap() {}

void MinHeap::swapNodes(int index1, int index2) {
    if (index1 < 0 || index1 >= heap.size() || index2 < 0 || index2 >= heap.size()) {
        throw out_of_range("Heap index out of range");
    }
    
    // Swap the nodes in the heap vector
    HeapNode temp = heap[index1];
    heap[index1] = heap[index2];
    heap[index2] = temp;
    
    // Update the index mapping
    nodeToIndex[heap[index1].nodeId] = index1;
    nodeToIndex[heap[index2].nodeId] = index2;
}

void MinHeap::bubbleUp(int index) {
    if (index == 0) return; // Already at root
    
    int parentIndex = (index - 1) / 2;
    
    // If current node is smaller than parent, swap and continue
    if (heap[index] > heap[parentIndex]) {
        return; // Min-heap property satisfied
    }
    
    swapNodes(index, parentIndex);
    bubbleUp(parentIndex);
}

void MinHeap::bubbleDown(int index) {
    int leftChild = 2 * index + 1;
    int rightChild = 2 * index + 2;
    int smallest = index;
    
    // Find the smallest among current node and its children
    if (leftChild < heap.size() && !(heap[leftChild] > heap[smallest])) {
        smallest = leftChild;
    }
    
    if (rightChild < heap.size() && !(heap[rightChild] > heap[smallest])) {
        smallest = rightChild;
    }
    
    // If smallest is not current node, swap and continue
    if (smallest != index) {
        swapNodes(index, smallest);
        bubbleDown(smallest);
    }
}

void MinHeap::addNode(int nodeId, int distance) {
    // Check if node already exists
    if (contains(nodeId)) {
        decreaseKey(nodeId, distance);
        return;
    }
    
    // Add new node to the end
    heap.push_back(HeapNode(nodeId, distance));
    int newIndex = heap.size() - 1;
    nodeToIndex[nodeId] = newIndex;
    
    // Bubble up to maintain heap property
    bubbleUp(newIndex);
}

HeapNode MinHeap::deleteRoot() {
    if (isEmpty()) {
        throw runtime_error("Cannot delete from empty heap");
    }
    
    HeapNode root = heap[0];
    
    if (heap.size() == 1) {
        heap.clear();
        nodeToIndex.clear();
    } else {
        // Move last element to root
        heap[0] = heap.back();
        heap.pop_back();
        
        // Update index mapping
        nodeToIndex.erase(root.nodeId);
        nodeToIndex[heap[0].nodeId] = 0;
        
        // Bubble down to maintain heap property
        bubbleDown(0);
    }
    
    return root;
}

void MinHeap::decreaseKey(int nodeId, int newDistance) {
    if (!contains(nodeId)) {
        throw invalid_argument("Node not found in heap");
    }
    
    int index = nodeToIndex[nodeId];
    
    // Only update if new distance is smaller
    if (newDistance >= heap[index].distance) {
        return;
    }
    
    // Update distance
    heap[index].distance = newDistance;
    
    // Bubble up to maintain heap property
    bubbleUp(index);
}

bool MinHeap::isEmpty() const {
    return heap.empty();
}

int MinHeap::size() const {
    return heap.size();
}

bool MinHeap::contains(int nodeId) const {
    return nodeToIndex.find(nodeId) != nodeToIndex.end();
}

int MinHeap::getDistance(int nodeId) const {
    auto it = nodeToIndex.find(nodeId);
    if (it == nodeToIndex.end()) {
        throw invalid_argument("Node not found in heap");
    }
    return heap[it->second].distance;
}

void MinHeap::clear() {
    heap.clear();
    nodeToIndex.clear();
}