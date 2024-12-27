const tooltip = d3.select("#tooltip");

function populateFileDropdown() {
    fetch('/get-files')
        .then(response => response.json())
        .then(files => {
            const fileSelect = document.getElementById('fileSelect');

            // Clear existing options (if any)
            fileSelect.innerHTML = '<option value="">Select a file</option>';

            // Populate with files from the server
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                fileSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching file list:', error));
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', populateFileDropdown);

let treeData;
function visualizeJSON(fileName) {

    if (!fileName) {
        console.error("No file selected");
        return;
    }


    fetch(`/get-json?file=${fileName}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch JSON data for file: ${fileName}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('JSON data fetched:', data); // Debugging log
            d3.select("#visualization").html("");   // Clear existing visualization

            //treeData = convertToTree(data);   // Convert JSON to tree
            //console.log('Tree data:', treeData);    // Debugging log
            // renderD3Tree(treeData);                  // Render with D3.js
            renderSentences(data.sentences);

        })
        .catch(error => console.error('Error fetching JSON data:', error));

    // Convert JSON to tree structure
    function convertToTree(obj, parent = null) {
        let result = { name: name };
        //console.log('Conversion of json to tree of :', obj); // Add this line

        //console.log('Conditions of conversion..', typeof obj === 'object'); // Add this line
        //console.log('Conditions of conversion..', obj !== null); // Add this line
        if (typeof obj === 'object' && obj !== null) {
            result.children = [];
            for (let key in obj) {
                if (Array.isArray(obj[key])) {
                    result.children.push({
                        name: key,
                        children: obj[key].map((item, index) =>
                            convertToTree(item, typeof item === 'object' ? key : item)
                        )
                    });
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    result.children.push(convertToTree(obj[key], key));
                } else {
                    result.children.push({
                        name: `${key}: ${obj[key]}`
                    });
                }
            }
        }
        return result;
    }

    //const treeData = convertToTree(data);
}

// Render sentences with events and time expressions
function renderSentences(sentences) {
    const container = d3.select("#visualization").html("");

    sentences.forEach(sentence => {
        const sentenceContainer = container.append("div").style("margin-bottom", "20px");

        // Display sentence text
        const sentenceText = sentenceContainer.append("div");

        let textSent = sentence.text_sent;
        let textTime = sentence.text_time;
        let index = textSent.indexOf(textTime);

        if (index !== -1) {
            // If found, split the sentence into three parts: before the match, the match, and after the match
            let beforeMatch = textSent.substring(0, index);
            let match = textSent.substring(index, index + textTime.length);
            let afterMatch = textSent.substring(index + textTime.length);

            // Append the parts to the sentenceText element, highlighting the match
            sentenceText.append("span").text(beforeMatch);  // Before the match
            sentenceText.append("span").text(match).attr("class", "yellow-box");  // Highlighted match
            sentenceText.append("span").text(afterMatch);  // After the match
        } else {
            // If no match is found, just append the whole sentence
            sentenceText.append("span").text(textSent);
        }

        // Display events
        /*sentence.events.forEach(event => {
            sentenceText.append("span")
                .text(event.text)
                .attr("class", "blue-box")
                .on("mouseover", function(event) {
                    tooltip
                        .style("left", `${event.pageX + 10}px`)
                        .style("top", `${event.pageY + 10}px`)
                        .style("display", "block")
                        .html(Object.entries(event).map(([key, value]) => `${key}: ${value}`).join("<br>"));
                })
                .on("mouseout", function() {
                    tooltip.style("display", "none");
                });
        });*/

        // Loop through each event
        sentence.events.forEach(event => {
            // Check if the event text is present in sentence.text
            let index = sentence.text.indexOf(event.text);

            if (index !== -1) {
                // Split sentence into three parts: before event, event text, after event
                let beforeMatch = sentence.text.substring(0, index);
                let match = sentence.text.substring(index, index + event.text.length);
                let afterMatch = sentence.text.substring(index + event.text.length);

                // Append before part
                sentenceText.append("span").text(beforeMatch);

                // Highlight the event text in blue and append event attributes on hover
                sentenceText.append("span")
                    .text(match)
                    .attr("class", "blue-box")
                    .on("mouseover", function(e) {
                        tooltip
                            .style("left", `${e.pageX + 10}px`)
                            .style("top", `${e.pageY + 10}px`)
                            .style("display", "block")
                            .html(Object.entries(event).map(([key, value]) => `${key}: ${value}`).join("<br>"));
                    })
                    .on("mouseout", function() {
                        tooltip.style("display", "none");
                    });

                // Append after part
                sentenceText.append("span").text(afterMatch);
            } else {
                // If event text isn't found in the sentence, just append the whole sentence
                sentenceText.append("span").text(sentence.text);
            }
        });

        // Display time expressions as cards
        const timeContainer = sentenceContainer.append("div");
        sentence.times.forEach(time => {
            timeContainer.append("div").attr("class", "card").text(time.text);
        });
    });
}

function renderD3Tree(treeData){
    if (!treeData) {
        console.error('Tree data is not defined');
        return;
    }

    // Set up the d3 tree visualization
    const width = 1000;
    const height = 800;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };

    // Create a hierarchical layout
    const tree = d3.tree()
        .size([height - margin.top - margin.bottom, width - margin.right - margin.left]);

    // Create the root node
    const root = d3.hierarchy(treeData);

    // Create the SVG container
    const svg = d3.select("#visualization")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Initialize the layout
    const nodes = tree(root);

    // Create the links
    const links = svg.selectAll(".link")
        .data(nodes.links())
        .enter()
        .append("path")
        .attr("class", "link");

    // Create the nodes
    const node = svg.selectAll(".node")
        .data(nodes.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    // Add circles to nodes
    node.append("circle")
        .attr("r", 4);

    // Add labels to nodes
    node.append("text")
        .attr("dy", ".35em")
        .attr("x", d => d.children ? -13 : 13)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);

    // Define drag behavior
    const drag = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);

    // Apply drag behavior to nodes
    node.call(drag);

    // Store original positions
    nodes.descendants().forEach(d => {
        d.originalX = d.x;
        d.originalY = d.y;
    });

    // Drag functions
    function dragstarted(event, d) {
        d3.select(this).raise().classed("active", true);
        // Show tooltip
        tooltip.style("opacity", 1)
            .html("Dragging: " + d.data.name)
            .style("left", (event.sourceEvent.pageX + 10) + "px")
            .style("top", (event.sourceEvent.pageY - 10) + "px");
    }

    function dragged(event, d) {
        // Update node position
        d.x = event.y;
        d.y = event.x;
        d3.select(this)
            .attr("transform", `translate(${d.y},${d.x})`);

        // Update tooltip position
        tooltip.style("left", (event.sourceEvent.pageX + 10) + "px")
            .style("top", (event.sourceEvent.pageY - 10) + "px");

        // Update connected links
        updateLinks();
    }

    function dragended(event, d) {
        d3.select(this).classed("active", false);
        // Hide tooltip
        tooltip.style("opacity", 0);
    }

    // Function to update links during drag
    function updateLinks() {
        links.attr("d", d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x));
    }

    // Initial link positioning
    updateLinks();

    // Add double-click to reset positions
    svg.on("dblclick", () => {
        // Reset all nodes to their original positions
        node.transition()
            .duration(750)
            .attr("transform", d => `translate(${d.originalY},${d.originalX})`);

        // Reset stored positions
        nodes.descendants().forEach(d => {
            d.x = d.originalX;
            d.y = d.originalY;
        });

        // Update links
        links.transition()
            .duration(750)
            .attr("d", d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x));
    });
}
