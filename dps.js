const express = require('express');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Set up Multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Endpoint to handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
    const { path: filePath } = req.file;

    // Read the PDF file (simulate processing)
    const pdfBuffer = fs.readFileSync(filePath);
    const csvFilePath = 'csv.csv'; // Path to static CSV file (in the same directory)

    // Simulated processing: Read static CSV file
    const csvData = fs.readFileSync(csvFilePath, 'utf-8');

    // Respond with the CSV data
    console.log(csvData);
    res.status(200).send(csvData);

    // Clean up: Remove uploaded file
    fs.unlinkSync(filePath);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
