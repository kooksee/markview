package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/k1LoW/mo/internal/build"
	"github.com/spf13/cobra"
)

var buildOutput string

var buildCmd = &cobra.Command{
	Use:   "build [DIR]",
	Short: "Build a static site from a directory of Markdown files",
	Long: `Build scans a directory for Markdown files (.md, .mdx) and generates
a self-contained static site that can be deployed to any web server.

The output is a directory containing index.html and all necessary assets,
with all file contents embedded. No server is needed to view the result.

Examples:
  mo build docs/                         Build from docs/ to docs-static/
  mo build docs/ -o dist/                Build from docs/ to dist/
  mo build .                             Build from current directory`,
	Args: cobra.ExactArgs(1),
	RunE: runBuild,
}

func init() {
	rootCmd.AddCommand(buildCmd)
	buildCmd.Flags().StringVarP(&buildOutput, "output", "o", "", "Output directory (default: <input>-static)")
}

func runBuild(_ *cobra.Command, args []string) error {
	inputDir := args[0]

	absInput, err := filepath.Abs(inputDir)
	if err != nil {
		return fmt.Errorf("cannot resolve input directory: %w", err)
	}

	info, err := os.Stat(absInput)
	if err != nil {
		return fmt.Errorf("input directory does not exist: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("%s is not a directory", absInput)
	}

	outputDir := buildOutput
	if outputDir == "" {
		outputDir = filepath.Base(absInput) + "-static"
	}

	absOutput, err := filepath.Abs(outputDir)
	if err != nil {
		return fmt.Errorf("cannot resolve output directory: %w", err)
	}

	fmt.Fprintf(os.Stderr, "mo: scanning %s for markdown files...\n", absInput)

	if err := build.BuildStaticSite(absInput, absOutput); err != nil {
		return err
	}

	fmt.Fprintf(os.Stderr, "mo: static site built to %s\n", absOutput)
	return nil
}
