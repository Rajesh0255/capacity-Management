sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/Panel",
    "sap/m/Text"
], function (Controller, JSONModel, MessageToast, Panel, Text) {
    "use strict";

    return Controller.extend("com.app.testing.controller.Home", {
        onInit: function () {
            const truckDimensions = {
                "14": { width: 2.1300, height: 2.1300, length: 4.2700 },
                "17": { width: 2.2900, height: 2.5900, length: 5.1800 },
                "22": { width: 2.4300, height: 2.5900, length: 6.7100 },
                "32": { width: 2.4400, height: 2.5900, length: 9.7500 }
            };

            const model = new JSONModel({
                products: [],
                truckDimensions: truckDimensions,
                selectedTruck: null,
                totalTruckQuantity: 0,
                remainingQuantity: 0
            });
            this.getView().setModel(model);
            if (typeof THREE === "undefined") {
                console.error("THREE.js is not loaded. Please check the script source.");
                return;
            }
            this.selectedContainer = {
                dimensions: { length: 4.2700 , height: 2.1300, width: 2.1300 }
            };
            this.productSize = { length: 1, width: 1, height: 1 };
            this.products = [];  // Store product positions
        },

        onTruckSizeChange: function () {
            debugger
            const selectedKey = this.byId("truckSize").getSelectedKey();
            const truckDimensions = this.getView().getModel().getProperty("/truckDimensions");
            const dimensions = truckDimensions[selectedKey];

            if (dimensions) {
                this.getView().getModel().setProperty("/selectedTruck", dimensions);
                this.calculateFit(); // Calculate fit whenever truck size changes
                // this.displayProductShapes(); // Display product shapes whenever truck size changes
                this._createContainer(dimensions);
              
            }
        },

        onAddProduct: function () {
            const products = this.getView().getModel().getProperty("/products");
            products.push({ name: "", width: "", height: "", length: "", quantity: 0, userQuantity: 0 });
            this.getView().getModel().setProperty("/products", products);
        },

        onProductInputChange: function () {
            this.calculateFit();
            // this.displayProductShapes(); // Update shapes on input change
        },

        onUserQuantityChange: function (oEvent) {
            const inputField = oEvent.getSource();
            const index = inputField.getBindingContext().getPath().split("/").pop();
            const quantity = parseInt(inputField.getValue(), 10) || 0;

            const products = this.getView().getModel().getProperty("/products");
            products[index].userQuantity = quantity; // Store user-defined quantity
            this.getView().getModel().setProperty("/products", products);

            this.calculateFit(); // Recalculate after user input
            // this.displayProductShapes(); // Update shapes after user input
        },

        calculateFit: function () {
            const products = this.getView().getModel().getProperty("/products");
            const selectedTruck = this.getView().getModel().getProperty("/selectedTruck");

            if (!selectedTruck) {
                MessageToast.show("Please select a truck size.");
                return;
            }

            // Clear previous error messages
            this.byId("errorMessage").setVisible(false);
            let totalFitCount = 0;
            let totalOccupiedVolume = 0;

            // Calculate fitting for each product
            products.forEach((product) => {
                const width = parseFloat(product.width);
                const height = parseFloat(product.height);
                const length = parseFloat(product.length);
                const userQuantity = parseInt(product.userQuantity, 10) || 0;

                if (width && height && length) {
                    const fitByWidth = Math.floor(selectedTruck.width / width);
                    const fitByHeight = Math.floor(selectedTruck.height / height);
                    const fitByLength = Math.floor(selectedTruck.length / length);
                    const maxFitCount = fitByWidth * fitByHeight * fitByLength;

                    if (userQuantity > maxFitCount) {
                        // Show message if the user quantity exceeds max fit
                        MessageToast.show(`The quantity of ${userQuantity} for this product exceeds truck capacity. Max fit is ${maxFitCount}.`);
                        product.userQuantity = maxFitCount; // Cap user quantity to max fit
                    } else {
                        product.userQuantity = userQuantity; // Use user-defined quantity
                    }

                    product.quantity = maxFitCount; // Update quantity in the product object
                    totalFitCount += userQuantity; // Total that can fit in this truck
                    totalOccupiedVolume += (width * height * length * product.userQuantity); // Calculate total volume occupied
                } else {
                    product.userQuantity = 0; // Reset quantity if dimensions are invalid
                }
            });

            // Update the model with calculated quantities
            this.getView().getModel().setProperty("/products", products);
            this.getView().getModel().setProperty("/totalTruckQuantity", totalFitCount);

            const totalTruckVolume = selectedTruck.width * selectedTruck.height * selectedTruck.length;
            const remainingVolume = totalTruckVolume - totalOccupiedVolume;
            this.getView().getModel().setProperty("/remainingQuantity", remainingVolume);

            this.byId("totalProductsText").setText(`Total Truck Quantity: ${totalFitCount}`);
            this.byId("remainingSpaceText").setText(`Remaining Area in Truck: ${remainingVolume.toFixed(2)} m³`);

            // Check if total fitting exceeds truck dimensions
            if (totalOccupiedVolume > totalTruckVolume) {
                const adjustmentMessage = this.prepareAdjustmentMessage(products, selectedTruck);
                this.byId("errorMessage").setText(adjustmentMessage);
                this.byId("errorMessage").setVisible(true);
            } else {
                this.byId("errorMessage").setVisible(false);
            }
        },

        prepareAdjustmentMessage: function (products, selectedTruck) {
            let totalOccupiedVolume = 0;
            let message = "Total occupied dimensions exceed truck capacity. Suggested adjustments:\n";

            // Calculate total volume occupied by products
            products.forEach((product) => {
                const width = parseFloat(product.width);
                const height = parseFloat(product.height);
                const length = parseFloat(product.length);
                const userQuantity = parseInt(product.userQuantity, 10) || 0;

                if (width && height && length) {
                    const productVolume = width * height * length;
                    totalOccupiedVolume += (productVolume * userQuantity);
                }
            });

            // If total volume exceeds truck volume, calculate suggested reductions
            if (totalOccupiedVolume > selectedTruck.width * selectedTruck.height * selectedTruck.length) {
                let remainingVolume = selectedTruck.width * selectedTruck.height * selectedTruck.length;

                // Suggest reductions for each product
                products.forEach((product) => {
                    const width = parseFloat(product.width);
                    const height = parseFloat(product.height);
                    const length = parseFloat(product.length);
                    const userQuantity = parseInt(product.userQuantity, 10) || 0;

                    if (width && height && length) {
                        const productVolume = width * height * length;

                        // Calculate how many of this product can fit
                        const maxAllowedQuantity = Math.floor(remainingVolume / productVolume);

                        if (userQuantity > maxAllowedQuantity) {
                            message += `- For product (W:${width}, H:${height}, L:${length}), reduce quantity to ${maxAllowedQuantity} (current: ${userQuantity}).\n`;
                            remainingVolume -= (productVolume * maxAllowedQuantity);
                        } else {
                            remainingVolume -= (productVolume * userQuantity);
                        }
                    }
                });
            }

            return message || "All products fit within the truck capacity.";
        },

        // displayProductShapes: function () {
        //     const products = this.getView().getModel().getProperty("/products");
        //     const vBox = this.byId("productDisplayVBox");
        //     vBox.removeAllItems(); // Clear previous shapes

        //     const selectedTruck = this.getView().getModel().getProperty("/selectedTruck");
        //     const truckWidth = selectedTruck.width;
        //     const truckLength = selectedTruck.length;

        //     products.forEach(product => {
        //         const width = parseFloat(product.width);
        //         const length = parseFloat(product.length);
        //         const height = parseFloat(product.height);

        //         if (product.name && width && length && height) {
        //             // Create a simple representation of the product
        //             const productBox = new Panel({
        //                 content: [
        //                     new Text({ text: `${product.name}: ${width}m x ${length}m x ${height}m` })
        //                 ],
        //                 width: `${(width / truckWidth) * 100}%`,
        //                 height: `${(length / truckLength) * 100}px`,
        //                 backgroundColor: "lightblue",
        //                 borderStyle: "Solid",
        //                 borderColor: "black"
        //             });

        //             vBox.addItem(productBox);
        //         }
        //     });
        // }


        onAfterRendering: function() {
            this._init3DScene();
        },

        _init3DScene: function () {
            debugger;
            this.scene = new THREE.Scene();
            
            // Set initial camera position to make the scene appear larger
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(10, 10, 10); // Set Z closer for larger initial view
        
            this.renderer = new THREE.WebGLRenderer({ alpha: true });
            this.renderer.setSize(1400, 780);
            this.renderer.setClearColor(0xffffff, 0);
        
            var threejsCanvas = document.getElementById("threejsCanvas");
            if (threejsCanvas) {
                threejsCanvas.appendChild(this.renderer.domElement);
            } else {
                console.error("threejsCanvas not found");
                return;
            }
        
            // Enable orbit controls for zooming and movement
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;       // Enable smooth controls
            this.controls.dampingFactor = 0.05;      // Smoothness of the movement
            this.controls.enableZoom = true;         // Allow zooming in and out
            this.controls.minDistance = 5;           // Decrease minDistance to allow zooming in more
            this.controls.maxDistance = 500;         // Increase maxDistance to allow zooming out more
            this.controls.zoomSpeed = 1.2;           // Zoom speed
        
            // Create a light source in the scene
            const light = new THREE.DirectionalLight(0xffffff, 1);
            light.position.set(10, 10, 10).normalize();
            this.scene.add(light);
        
            // Call to create your container (if needed)
            this._createContainer(this.selectedContainer.dimensions);
        
            // Create a group to store products
            this.productLayer = new THREE.Group();
            this.scene.add(this.productLayer);
        
            // Start the animation loop
            this._animate();
        },
        
        
        // Animate function for the rendering loop
        _animate: function () {
            var self = this;
            function animate() {
                requestAnimationFrame(animate);
                self.controls.update();  // Update controls for damping
                self.renderer.render(self.scene, self.camera);
            }
            animate();
        },
        

        _createContainer: function (dimensions) {
            // Remove the previous container if it exists
            if (this.currentContainer) {
                this.scene.remove(this.currentContainer);
                this.currentContainer.geometry.dispose();
                this.currentContainer.material.dispose();
            }
        
            const containerMaterial = new THREE.MeshStandardMaterial({
                color: 0x64748b,
                transparent: true,
                opacity: 0.2
            });
            
            const truckContainer = this._createBox(dimensions.length, dimensions.height, dimensions.width, containerMaterial);
        
            // Check if truckContainer is valid
            if (!truckContainer) {
                console.error("Error: _createBox did not return a valid THREE.Object3D instance.");
                return;
            }
            
            truckContainer.position.set(0, dimensions.height / 2, 0);
            this.scene.add(truckContainer);
            this.currentContainer = truckContainer;
        
            // Remove and recreate border lines for the new container
            if (this.currentBorderLines) {
                this.scene.remove(this.currentBorderLines);
            }
            this.currentBorderLines = this._createBorderLines(dimensions);
            
            // Check if currentBorderLines is valid
            if (!this.currentBorderLines) {
                console.error("Error: _createBorderLines did not return a valid THREE.Object3D instance.");
                return;
            }
            
            this.scene.add(this.currentBorderLines);
        },
        
        _createBorderLines: function (dimensions) {
            const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(dimensions.length, dimensions.height, dimensions.width));
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
            const borderLines = new THREE.LineSegments(edges, lineMaterial);
            borderLines.position.set(0, dimensions.height / 2, 0);
            return borderLines;  // Ensure this is returned
        },

        _createBoxGeometry: function (width, height, depth) {
            return new THREE.BoxGeometry(width, height, depth);
        },

        _createBox: function (width, height, depth, material) {
            const geometry = this._createBoxGeometry(width, height, depth);
            return new THREE.Mesh(geometry, material);
        },

        _createFloorLayer: function () {
            const floorMaterial = new THREE.MeshStandardMaterial({
                color: 0xFFFFF,
                transparent: false,
                opacity: 1
            });
            const floorGeometry = new THREE.PlaneGeometry(100, 100);
            const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
            floorMesh.rotation.x = -Math.PI / 2;
            floorMesh.position.set(0, 0, 0);
            this.scene.add(floorMesh);
        },

        _animate: function () {
            const animate = () => {
                requestAnimationFrame(animate);
                this.controls.update();
                this.renderer.render(this.scene, this.camera);
            };
            animate();
        },

        onAddProduct1: function (oEvent) {
            const sProduct = oEvent.getSource().getCustomData()[0].getValue();
            const position = this._getNextAvailablePosition();

            if (!position) {
                this._createNewContainer();
                return;
            }

            const productMesh = this._createProductMesh(sProduct);
            productMesh.position.set(position.x, position.y, position.z);
            this.productLayer.add(productMesh);
            this._enableDrag(productMesh);
            this.products.push(productMesh);  // Store product for tracking
        },

        _createNewContainer: function () {
            this._createContainer(this.selectedContainer.dimensions);
            this.products = [];
        },

        _createProductMesh: function (sProduct) {
            let color;
            switch (sProduct) {
                case "Product B":
                    color = 0x0000ff; // Blue
                    break;
                case "Product C":
                    color = 0xff00ff; // Pink
                    break;
                default:
                    color = 0x00ff00; // Green
            }

            // Create the main product box
            const material = new THREE.MeshBasicMaterial({ color: color });
            const productBox = this._createBox(this.productSize.length, this.productSize.height, this.productSize.width, material);

            // Create the border for the product
            const borderMaterial = new THREE.LineBasicMaterial({ color: 0x000000 }); // Black border
            const borderGeometry = new THREE.EdgesGeometry(this._createBoxGeometry(this.productSize.length, this.productSize.height, this.productSize.width));
            const borderLines = new THREE.LineSegments(borderGeometry, borderMaterial);

            // Add both product and border to a group so they move together
            const productGroup = new THREE.Group();
            productGroup.add(productBox);
            productGroup.add(borderLines);

            return productGroup;
        },

        _getNextAvailablePosition: function () {
            const container = this.selectedContainer.dimensions;
            const rows = Math.floor(container.width / this.productSize.width);
            const layers = Math.floor(container.height / this.productSize.height);
            const columns = Math.floor(container.length / this.productSize.length);

            if (this.products.length >= rows * columns * layers) return null;  // Check if container is full

            const productCount = this.products.length;
            const x = (productCount % columns) * this.productSize.length - container.length / 2 + this.productSize.length / 2;
            const z = Math.floor(productCount / columns) % rows * this.productSize.width - container.width / 2 + this.productSize.width / 2;
            const y = Math.floor(productCount / (columns * rows)) * this.productSize.height;
            
            return { x, y, z };
        },

        _enableDrag: function (meshGroup) {
            debugger
            const dragControls = new THREE.DragControls([meshGroup], this.camera, this.renderer.domElement);
        
            dragControls.addEventListener('dragstart', (event) => {
                if (event.object.children.length > 0 && event.object.children[0].material) {
                    event.object.children[0].material.opacity = 0.5; // Adjust opacity of main box on drag start
                }
                this.controls.enabled = false;
            });
        
            dragControls.addEventListener('dragend', (event) => {
                if (event.object.children.length > 0 && event.object.children[0].material) {
                    event.object.children[0].material.opacity = 1; // Reset opacity on drag end
                }
                this.controls.enabled = true;
                this._snapToGrid(event.object);  // Snap to grid on release
                console.log(event.object);
            });
        },

        _snapToGrid: function (meshGroup) {
            const position = this._getNextAvailablePosition();
            if (position) {
                meshGroup.position.set(position.x, position.y, position.z);
            }
        }
    });
});
