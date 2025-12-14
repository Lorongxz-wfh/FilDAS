<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class DocumentConversionService
{
    private string $libreOfficePath;

    public function __construct()
    {
        // Get LibreOffice path from config, with fallback
        $this->libreOfficePath = config('docswap.libreoffice_path', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe');
    }

    /**
     * Convert a document to PDF for preview
     * Supports: DOCX, XLSX, PPTX, DOC, XLS, PPT
     */
    public function convertToPdf(string $inputPath): ?string
    {
        $disk = Storage::disk('fildasdocs');
        $inputFullPath = $disk->path($inputPath);

        // Verify input file exists
        if (!file_exists($inputFullPath)) {
            Log::error('Input file does not exist', ['path' => $inputFullPath]);
            return null;
        }

        // Generate output path: same location, same base name, .pdf extension
        $outputPath = preg_replace('/\.[^.]+$/', '.pdf', $inputPath);
        $outputFullPath = $disk->path($outputPath);

        // Create output directory if it doesn't exist
        $outputDir = dirname($outputFullPath);
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        // Build the LibreOffice command
        $command = [
            $this->libreOfficePath,
            '--headless',
            '--convert-to',
            'pdf',
            '--outdir',
            $outputDir,
            $inputFullPath
        ];

        $process = new Process($command);
        $process->setTimeout(120);

        try {
            $process->mustRun();

            // LibreOffice converts to the same filename with .pdf extension
            $convertedFile = pathinfo($inputFullPath, PATHINFO_FILENAME) . '.pdf';
            $expectedOutput = $outputDir . DIRECTORY_SEPARATOR . $convertedFile;

            // Rename to our desired output path if different
            if (file_exists($expectedOutput) && $expectedOutput !== $outputFullPath) {
                rename($expectedOutput, $outputFullPath);
            }

            if (!file_exists($outputFullPath)) {
                Log::error('Converted PDF not found', [
                    'expected' => $expectedOutput,
                    'desired' => $outputFullPath
                ]);
                return null;
            }

            return $outputPath; // Return the relative path to the converted PDF
        } catch (ProcessFailedException $e) {
            Log::error('LibreOffice conversion failed', [
                'input' => $inputPath,
                'error' => $e->getMessage(),
                'output' => $process->getOutput(),
                'errorOutput' => $process->getErrorOutput()
            ]);
            return null;
        }
    }


    /**
     * Check if a file should be converted to PDF
     */
    public function shouldConvert(string $mimeType): bool
    {
        $convertibleTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
            'application/msword', // DOC
            'application/vnd.ms-excel', // XLS
            'application/vnd.ms-powerpoint', // PPT
        ];

        return in_array($mimeType, $convertibleTypes);
    }

    /**
     * Get the configured LibreOffice path
     */
    public function getLibreOfficePath(): string
    {
        return $this->libreOfficePath;
    }

    /**
     * Verify LibreOffice is installed and accessible
     */
    public function isLibreOfficeAvailable(): bool
    {
        return file_exists($this->libreOfficePath);
    }
}
