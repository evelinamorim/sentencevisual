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
        const sentenceText = sentenceContainer.append("div");
        let textSent = sentence.text_sent;
        let fragments = [];

       // First, collect all highlights (both time and events)
        let highlights = [
            { text: sentence.text_time.replace(",","").trim(), type: 'yellow-box' },
            ...sentence.events.map(event => ({
                text: event.text_event,
                type: 'blue-box',
                event: event
            }))
        ];
        console.log(highlights);
       // Sort highlights by their position in the text
        highlights.forEach(highlight => {
            highlight.index = textSent.indexOf(highlight.text);
        });
        highlights = highlights.filter(h => h.index !== -1)
            .sort((a, b) => a.index - b.index);

       // Build fragments
        let lastIndex = 0;
        highlights.forEach(highlight => {
            // Add text before highlight
            if (highlight.index > lastIndex) {
                fragments.push({
                    text: textSent.substring(lastIndex, highlight.index),
                    type: 'normal'
                });
            }

            // Add highlighted text
            fragments.push({
                text: highlight.text,
                type: highlight.type,
                event: highlight.event
            });

            lastIndex = highlight.index + highlight.text.length;
        });

       // Add remaining text
        if (lastIndex < textSent.length) {
            fragments.push({
                text: textSent.substring(lastIndex),
                type: 'normal'
            });
        }

        // Render fragments
        fragments.forEach(fragment => {
            let span = sentenceText.append("span")
                .text(fragment.text);

            if (fragment.type !== 'normal') {
                span.attr("class", fragment.type);

                if (fragment.event) {
                    span.on("mouseover", function(e) {
                        tooltip
                            .style("left", `${e.pageX + 10}px`)
                            .style("top", `${e.pageY + 10}px`)
                            .style("display", "block")
                            .html(Object.entries(fragment.event)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join("<br>")
                            );
                    })
                        .on("mouseout", function(e) {
                            tooltip.style("display", "none");
                        });
                }
            }
        });

        // Display time expressions as cards
        const timeContainer = sentenceContainer.append("div")
            .attr("class","card")
            .style("display","flex")
            .style("gap","10px");

        timeContainer.append("div")
            .style("font-weight", "bold")      // Bold text
            .style("margin-bottom", "10px")   // Space below the title
            .style("font-size", "14px")       // Slightly larger font size for title
            .text("Linked Time Expressions"); // Title text
        sentence.times.forEach(time => {

            const card = timeContainer.append("div")
                .attr("class", "card")
                .style("padding", "10px")
                .style("border", "1px solid #ccc")
                .style("border-radius", "5px")
                .style("background-color", "#ffffff")
                .style("color", "#000000") ;



            Object.entries(time).forEach(([key, value]) => {
                card.append("div")
                    .style("margin-bottom", "5px") // Add spacing between fields
                    .style("font-size", "12px")    // Adjust text size
                    .html(`<strong>${key}:</strong> ${value}`); // Display key-value pair
            });
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
