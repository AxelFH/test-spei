const express = require('express');
const multer = require('multer');
const fs = require('fs');
const puppeteer = require('puppeteer');
const axios = require('axios');
const app = express();
const port = 3000;
const csv = require('csv-parser');
const unzipper = require('unzipper');
const path = require('path');
const xml2js = require('xml2js');
const { v4: uuidv4 } = require('uuid');
const fsExtra = require('fs-extra');

// Set up multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Mapping of institution names to their corresponding numeric codes
const institutionCodeMap = {
    'ABC CAPITAL': '40138',
    'ACTINVER': '40133',
    'AFIRME': '40062',
    'ALTERNATIVOS': '90661',
    'ARCUS': '90706',
    'ASP INTEGRA OPC': '90659',
    'AUTOFIN': '40128',
    'AZTECA': '40127',
    'BaBien': '37166',
    'BAJIO': '40030',
    'BANAMEX': '40002',
    'BANCO COVALTO': '40154',
    'BANCOMEXT': '37006',
    'BANCOPPEL': '40137',
    'BANCO S3': '40160',
    'BANCREA': '40152',
    'BANJERCITO': '37019',
    'BANKAOOL': '40147',
    'BANK OF AMERICA': '40106',
    'BANK OF CHINA': '40159',
    'BANOBRAS': '37009',
    'BANORTE': '40072',
    'BANREGIO': '40058',
    'BANSI': '40060',
    'BANXICO': '2001',
    'BARCLAYS': '40129',
    'BBASE': '40145',
    'BBVA MEXICO': '40012',
    'BMONEX': '40112',
    'CAJA POP MEXICA': '90677',
    'CAJA TELEFONIST': '90683',
    'CB INTERCAM': '90630',
    'CIBANCO': '40143',
    'CI BOLSA': '90631',
    'CLS': '90901',
    'CoDi Valida': '90903',
    'COMPARTAMOS': '40130',
    'CONSUBANCO': '40140',
    'CREDICAPITAL': '90652',
    'CREDICLUB': '90688',
    'CRISTOBAL COLON': '90680',
    'Cuenca': '90723',
    'DONDE': '40151',
    'FINAMEX': '90616',
    'FINCOMUN': '90634',
    'FOMPED': '90689',
    'FONDO (FIRA)': '90685',
    'GBM': '90601',
    'HIPOTECARIA FED': '37168',
    'HSBC': '40021',
    'ICBC': '40155',
    'INBURSA': '40036',
    'INDEVAL': '90902',
    'INMOBILIARIO': '40150',
    'INTERCAM BANCO': '40136',
    'INVEX': '40059',
    'JP MORGAN': '40110',
    'KUSPIT': '90653',
    'LIBERTAD': '90670',
    'MASARI': '90602',
    'Mercado Pago W': '90722',
    'MIFEL': '40042',
    'MIZUHO BANK': '40158',
    'MONEXCB': '90600',
    'MUFG': '40108',
    'MULTIVA BANCO': '40132',
    'NAFIN': '37135',
    'NU MEXICO': '90638',
    'NVIO': '90710',
    'PAGATODO': '40148',
    'PROFUTURO': '90620',
    'SABADELL': '40156',
    'SANTANDER': '40014',
    'SCOTIABANK': '40044',
    'SHINHAN': '40157',
    'STP': '90646',
    'TESORED': '90703',
    'TRANSFER': '90684',
    'UNAGRA': '90656',
    'VALMEX': '90617',
    'VALUE': '90605',
    'VECTOR': '90608',
    'VE POR MAS': '40113',
    'VOLKSWAGEN': '40141'
};


// API endpoint to upload CSV file and automate form submission
app.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded. Please upload a file.');
    }

    const { path: filePath, mimetype, originalname } = req.file;

    // Check if the uploaded file is a CSV
    if (mimetype !== 'text/csv' && !originalname.toLowerCase().endsWith('.csv')) {
        // If not a CSV, delete the file and respond with an error
        fs.unlinkSync(filePath); // Delete the invalid file
        return res.status(400).send('Invalid file format. Please upload a CSV file.');
    }

    try {
        // Read the CSV file
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                // Remove the temporary file
                fs.unlinkSync(filePath);

                processCSVAndGenerateTxt(results, res); // Process CSV data
            });

    } catch (error) {
        console.error('Error during file upload and processing:', error);
        res.status(500).send('Error during file upload and processing');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

async function processCSVAndGenerateTxt(results, res) {

    const txtFileName = uuidv4();
    const txtFilePath = `txts/${txtFileName}.txt`;
    const zipFolderPath = path.resolve('zips');
    const stream = fs.createWriteStream(txtFilePath, { flags: 'a' });

    // Iterate over each row in the results
    results.forEach(row => {
        // Extract values from the row
        const fecha = row.Fecha;
        const claveRastreo = row.ClaveRastreo;
        const emisora = institutionCodeMap[row.Emisora];
        const receptora = institutionCodeMap[row.Receptora];
        const cuenta = row.Cuenta;
        const cargos = row.Cargos;

        // Write the row to the text file
        stream.write(`${fecha},${claveRastreo},${emisora},${receptora},${cuenta},${cargos}\n`);
    });
    stream.end();

    const filePath = `${txtFilePath}`;

    // Launch Puppeteer and navigate to the form URL
    const browser = await puppeteer.launch({ 
        headless: true, 
        executablePath: '/usr/bin/chromium-browser' 
    }); // Launch browser
    const page = await browser.newPage(); // Open new tab

    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: zipFolderPath
    });

    try {

        await page.goto('https://www.banxico.org.mx/cep-scl/inicio.do'); // Navigate to the form URL

        const input = await page.$('#input-file');
        await input.uploadFile(filePath);

        // Fill in the email input field
        await page.type('input[name="correo"]', 'aaron@vulcanics.mx');

        // Select the second option "XML" from the dropdown
        await page.select('select[name="formato"]', '2');

        let token = null;
        let attempts = 0;
        const maxAttempts = 3;
        while (!token && attempts < maxAttempts) {
            await page.click('#btn_grupo-footer');
            // Wait for the result form to load
            await Promise.race([
                page.waitForSelector('form[action="descarga.do"]'),
                page.waitForSelector('p.mensaje_error')
            ]);

            // Check if the token is present
            token = await page.evaluate(() => {
                const tokenElements = document.querySelectorAll('form[action="descarga.do"] strong');
                // Select the second occurrence of the strong element, if it exists
                return tokenElements.length > 1 ? tokenElements[1].innerText.trim() : null;
            });

            if (!token) {
                // If token is not found, go back and retry
                await page.goBack();
                attempts++;
            }
        }

        if (token) {
            await page.goBack();
            await page.click('a.boton[href="inicio2.do"]');

            await page.type('input[name="correo"]', 'aaron@vulcanics.mx');
            await page.type('input[name="token"]', token);

            let data = null;
            while (!data) {
                await page.click('input[type="button"][value="Consultar resultado"]');
                // Wait for the result form to load
                await Promise.race([
                    page.waitForSelector('form.styled.horizontal[style*="padding:20px;"]'), // Check for processing message
                    page.waitForSelector('input[type="button"][value="Descargar"]') // Check for download button
                ]);

                // Check if the processing message form is present
                const processingMessageForm = await page.$('form.styled.horizontal[style*="padding:20px;"]');
                if (processingMessageForm) {
                    // If data is still processing, wait for a few seconds before retrying
                    await page.goBack();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } else {
                    data = true;
                    page.click('input[type="button"][value="Descargar"]');

                    await waitUntilDownload(page, token + '.zip');
                    browser.close();

                    fs.unlink(txtFilePath, (err) => {
                        if (err) {
                            console.error('Error while deleting text file:', err);
                        }
                    });

                    unzipFile(zipFolderPath + "/" + token + ".zip", zipFolderPath + "/" + token + "/")
                        .then(() => {
                            fs.unlink(zipFolderPath + "/" + token + ".zip", (err) => {
                                if (err) {
                                    console.error('Error while deleting zip file:', err);
                                }
                            });
                            compareTransactions(results, zipFolderPath + "/" + token + "/")
                                .then(resString => {
                                    res.status(200).send(resString);
                                })
                                .catch(error => {
                                    console.error('Error during transaction comparison:', error);
                                    res.status(500).send('Error during transaction comparison');
                                });
                        })
                        .catch(error => {
                            console.error('Error while unzipping file:', error);
                            res.status(500).send('Error while unzipping file');
                        });
                }
            }

        } else {
            console.error('Failed to retrieve token after maximum attempts, check the status of banxico.');
            res.status(500).send('Failed to retrieve token after maximum attempts, check the status of banxico.');
        }
    } catch (error) {
        console.error('Error during Puppeteer automation:', error);
        res.status(500).send('Error during Puppeteer automation');
    }
}

// Function to unzip the downloaded file
async function unzipFile(zipFilePath, outputFolderPath) {
    // Ensure that the output folder exists
    if (!fs.existsSync(outputFolderPath)) {
        fs.mkdirSync(outputFolderPath, { recursive: true });
    }

    // Extract files from the zip archive
    await fs.createReadStream(zipFilePath)
        .pipe(unzipper.Extract({ path: outputFolderPath }))
        .promise();
}

async function waitUntilDownload(page, fileName = '') {
    return new Promise((resolve, reject) => {
        page._client().on('Page.downloadProgress', e => { // or 'Browser.downloadProgress'
            if (e.state === 'completed') {
                resolve(fileName);
            } else if (e.state === 'canceled') {
                reject();
            }
        });
    });
}


async function compareTransactions(results, zipFolderPath) {
    // Iterate over each result
    let responseString = '';
    for (const row of results) {


        const claveRastreo = row.ClaveRastreo;

        const fecha = row.Fecha;
        const emisora = row.Emisora;
        const receptora = row.Receptora;
        const cuenta = row.Cuenta;
        const cargos = row.Cargos;

        const xmlFileName = `[${row.Fecha}]${claveRastreo}.xml`;
        const xmlFilePath = path.join(zipFolderPath, xmlFileName);

        try {
            const xmlExists = fs.existsSync(xmlFilePath);

            if (xmlExists) {
                // Read XML file
                const xmlData = fs.readFileSync(xmlFilePath, 'utf8');
                // Convert XML to JSON
                const parser = new xml2js.Parser();
                const jsonData = await parser.parseStringPromise(xmlData);

                // Extract relevant data from JSON
                const xmlClaveRastreo = jsonData.SPEI_Tercero.$.claveRastreo;
                const xmlFecha = jsonData.SPEI_Tercero.$.FechaOperacion;
                const xmlCuenta = jsonData.SPEI_Tercero.Beneficiario[0].$.Cuenta;
                const xmlCargo = parseFloat(jsonData.SPEI_Tercero.Beneficiario[0].$.MontoPago).toFixed(2);

                const xmlEmisora = (jsonData.SPEI_Tercero.Ordenante[0].$.BancoEmisor === "BBVA BANCOMER") ? "BBVA MEXICO" : jsonData.SPEI_Tercero.Ordenante[0].$.BancoEmisor;

                const xmlReceptora = (jsonData.SPEI_Tercero.Beneficiario[0].$.BancoReceptor === "BBVA BANCOMER") ? "BBVA MEXICO" : jsonData.SPEI_Tercero.Beneficiario[0].$.BancoReceptor;

                let compareData = claveRastreo === xmlClaveRastreo;
                compareData = xmlFecha === fecha;

                compareData = xmlEmisora === emisora;
                compareData = xmlReceptora === receptora;
                compareData = xmlCuenta === cuenta;
                compareData = xmlCargo === parseFloat(cargos).toFixed(2);


                // Compare the ClaveRastreo from the CSV with the one from the XML
                if (compareData) {
                    // Perform further comparison or processing if needed
                    responseString = responseString + claveRastreo + ",true;"

                } else {
                    responseString = responseString + claveRastreo + ",false;"
                }
            } else {
                // XML file does not exist, update response string to false
                responseString = responseString + claveRastreo + ",false;";
            }
        } catch (error) {
            console.error(`Error while comparing transaction ${claveRastreo} with XML:`, error);
            // Handle error if needed
        }
    }

    // After processing all XML files, delete the folder
    try {
        await fsExtra.remove(zipFolderPath);
    } catch (error) {
        console.error('Error while deleting folder:', error);
    }
    console.log(responseString)
    return responseString;
}

//Single spei request (FAILS A LOT WHEN MULTIPLE REQUESTS ARE DONE AT THE SAME TIME)
/*
async function automateFormSubmission(results, res) {
    const { Fecha, ClaveRastreo, Emisora, Receptora, Cuenta, Cargos } = results;

    console.log(results)
    // Launch Puppeteer and navigate to the form URL
    const browser = await puppeteer.launch({ headless: true }); // Launch browser
    const page = await browser.newPage(); // Open new tab
    try {

        await page.goto('https://www.banxico.org.mx/cep/'); // Navigate to the form URL

        await page.waitForSelector('#input_fecha');

        const customDate = Fecha;
        await page.evaluate((date) => {
            // Locate the date input element and set its value to the custom date
            const fechaInput = document.querySelector('#input_fecha');
            fechaInput.value = date;
        }, customDate);


        await page.type('#input_criterio', ClaveRastreo);

        // Select "Institución emisora del pago" based on CSV data
        const emisoraCode = institutionCodeMap[Emisora];
        if (emisoraCode) {
            await page.select('#input_emisor', emisoraCode);
        } else {
            console.error(`Institution code not found for: ${Emisora}`);
        }


        //Why is this here:
        //There seems to be a script in the banxico site to change the value of this select after a couple seconds
        //Most likely so the default values of the banks are not the same when the user opens the site
        await page.waitForFunction(() => {
            const selectElement = document.querySelector('#input_receptor');
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            return selectedOption.index !== 0; // Wait until the selected index is not the first option (⌐■_■)
        });

        // Select "Institución receptora del pago" based on CSV data
        const receptoraCode = institutionCodeMap[Receptora];
        if (receptoraCode) {
            await page.select('#input_receptor', receptoraCode);
        } else {
            console.error(`Institution code not found for: ${Receptora}`);
        }

        await page.type('#input_cuenta', Cuenta);
        await page.type('#input_monto', Cargos);

        // Loop to repeatedly click the button until the desired condition is met, this sucks but it works ¯\_(ツ)_/¯
        let divVisible = false;

        while (!divVisible) {
            // Click the submit button
            await page.click('#btn_Descargar');

            // Wait for a short delay using page.evaluate
            await page.evaluate(() => {
                return new Promise(resolve => {
                    setTimeout(resolve, 2000); // Wait for 1 second
                });
            });

            // Check if the div is visible (i.e., display is not 'none')
            divVisible = await page.evaluate(() => {
                const div = document.querySelector('#divValidacionPertenencia');
                return window.getComputedStyle(div).display !== 'none';
            });
        }

        let downloadButtonExists = false;
        while (!downloadButtonExists) {

            downloadButtonExists = await page.evaluate(() => {
                const downloadButton = document.querySelector('.boton-descarga-pdf');
                return !!downloadButton; // Check if download button exists
            });
            if (!downloadButtonExists) {
                // If download button doesn't exist, close the browser and restart the process
                await browser.close();
                return automateFormSubmission(results, res); // Recursively call the function
            }
        }

        //This is where the code breaks some times, as the form sometimes just never renders this button (it's on a popup)
        page.click('.boton-descarga-pdf');

        const response = await page.waitForResponse(response => response.url().startsWith('https://www.banxico.org.mx/cep/descarga.do?formato=PDF'));

        // Get the filename from the Content-Disposition header
        const contentDisposition = response.headers()['content-disposition'];
        const filenameMatch = contentDisposition.match(/filename=([^;]+)/);
        const filename = filenameMatch ? filenameMatch[1] : 'downloaded.pdf';


        await new Promise(resolve => setTimeout(resolve, 2000)); // 2000 milliseconds = 2 seconds

        // Assuming the PDF is downloaded and saved to a specific path
        const downloadedFilePath = 'C:/Users/Dell/Downloads/' + filename;

        // Read the downloaded file
        const pdfBuffer = fs.readFileSync(downloadedFilePath);

        // Set response headers for the PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send the PDF as response
        res.send(pdfBuffer);

        await browser.close();

        // Delete the downloaded file after sending the response and we're done 
        fs.unlinkSync(downloadedFilePath);


    } catch (error) {
        console.error('Error during Puppeteer automation:', error);
        res.status(500).send('Error during Puppeteer automation');
    }
}
*/