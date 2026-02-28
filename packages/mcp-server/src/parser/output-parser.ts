import sax from 'sax';
import {
  StructuredOutput,
  FileChange,
  FileCreated,
  FileDeleted,
  PackageInstalled,
  McpServerSetup,
  WebSearchPerformed,
  ToolCallSummary,
  PreviewUrl,
  OutputNote,
} from '../types.js';

interface ParserState {
  output: StructuredOutput;
  currentElement: string | null;
  currentFile: Partial<FileChange> | null;
  currentFileCreated: Partial<FileCreated> | null;
  currentFileDeleted: Partial<FileDeleted> | null;
  currentPackage: Partial<PackageInstalled> | null;
  currentServer: Partial<McpServerSetup> | null;
  currentSearch: Partial<WebSearchPerformed> | null;
  currentTool: Partial<ToolCallSummary> | null;
  currentUrl: Partial<PreviewUrl> | null;
  currentNote: Partial<OutputNote> | null;
  textBuffer: string;
  inExecutionOutput: boolean;
  parentElement: string | null;
}

/**
 * Parses execution output XML into a StructuredOutput object.
 * Returns null if the input is not valid structured output XML.
 * Falls back gracefully - returns partial data if some elements fail.
 */
export function parseStructuredOutput(output: string): StructuredOutput | null {
  // Find the execution_output XML block anywhere in the output
  const startTag = '<execution_output>';
  const endTag = '</execution_output>';

  const startIndex = output.indexOf(startTag);
  const endIndex = output.indexOf(endTag);

  // If we can't find both tags, return null
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }

  // Extract just the XML portion
  const xmlContent = output.substring(startIndex, endIndex + endTag.length);

  const parser = sax.parser(true, { trim: true });
  const state: ParserState = {
    output: {},
    currentElement: null,
    currentFile: null,
    currentFileCreated: null,
    currentFileDeleted: null,
    currentPackage: null,
    currentServer: null,
    currentSearch: null,
    currentTool: null,
    currentUrl: null,
    currentNote: null,
    textBuffer: '',
    inExecutionOutput: false,
    parentElement: null,
  };

  parser.onerror = () => {
    // Error handled silently - we extract what we can
  };

  parser.onopentag = (tag) => {
    state.textBuffer = '';
    state.currentElement = tag.name;

    switch (tag.name) {
      case 'execution_output':
        state.inExecutionOutput = true;
        break;

      case 'files_changed':
      case 'files_created':
      case 'files_deleted':
      case 'packages_installed':
      case 'mcp_setup':
      case 'web_searches':
      case 'tool_calls':
      case 'preview_urls':
      case 'notes':
        state.parentElement = tag.name;
        break;

      case 'file':
        if (state.parentElement === 'files_changed') {
          state.currentFile = {
            path: tag.attributes.path as string,
            linesAdded: tag.attributes.lines_added
              ? parseInt(tag.attributes.lines_added as string, 10)
              : undefined,
            linesRemoved: tag.attributes.lines_removed
              ? parseInt(tag.attributes.lines_removed as string, 10)
              : undefined,
          };
        } else if (state.parentElement === 'files_created') {
          state.currentFileCreated = {
            path: tag.attributes.path as string,
            lines: tag.attributes.lines
              ? parseInt(tag.attributes.lines as string, 10)
              : undefined,
          };
        } else if (state.parentElement === 'files_deleted') {
          state.currentFileDeleted = {
            path: tag.attributes.path as string,
          };
        }
        break;

      case 'package':
        state.currentPackage = {
          name: tag.attributes.name as string,
          version: tag.attributes.version as string,
          dev: tag.attributes.dev === 'true',
        };
        break;

      case 'server':
        state.currentServer = {
          name: tag.attributes.name as string,
          status: (tag.attributes.status as McpServerSetup['status']) || 'installed',
        };
        break;

      case 'search':
        state.currentSearch = {
          query: tag.attributes.query as string,
          resultsUsed: tag.attributes.results_used
            ? parseInt(tag.attributes.results_used as string, 10)
            : undefined,
        };
        break;

      case 'tool':
        state.currentTool = {
          name: tag.attributes.name as string,
          count: tag.attributes.count
            ? parseInt(tag.attributes.count as string, 10)
            : 1,
        };
        break;

      case 'url':
        state.currentUrl = {
          type: tag.attributes.type as string,
        };
        break;

      case 'note':
        // Handle <note> with or without <notes> parent
        state.currentNote = {
          type: (tag.attributes.type as OutputNote['type']) || 'info',
        };
        break;

      case 'decision':
        // Ignore decision elements (not in our schema but agents might send them)
        break;
    }
  };

  parser.onclosetag = (tagName) => {
    const text = state.textBuffer.trim();

    switch (tagName) {
      case 'execution_output':
        state.inExecutionOutput = false;
        break;

      case 'files_changed':
      case 'files_created':
      case 'files_deleted':
      case 'packages_installed':
      case 'mcp_setup':
      case 'web_searches':
      case 'tool_calls':
      case 'preview_urls':
      case 'notes':
        state.parentElement = null;
        break;

      case 'overview':
        if (state.inExecutionOutput) {
          state.output.overview = text;
        }
        break;

      case 'diff':
        if (state.currentFile) {
          state.currentFile.diff = text;
        }
        break;

      case 'config':
        if (state.currentServer) {
          state.currentServer.config = text;
        }
        break;

      case 'file':
        if (state.parentElement === 'files_changed' && state.currentFile) {
          if (!state.output.filesChanged) {
            state.output.filesChanged = [];
          }
          state.output.filesChanged.push(state.currentFile as FileChange);
          state.currentFile = null;
        } else if (state.parentElement === 'files_created' && state.currentFileCreated) {
          if (!state.output.filesCreated) {
            state.output.filesCreated = [];
          }
          state.output.filesCreated.push(state.currentFileCreated as FileCreated);
          state.currentFileCreated = null;
        } else if (state.parentElement === 'files_deleted' && state.currentFileDeleted) {
          if (!state.output.filesDeleted) {
            state.output.filesDeleted = [];
          }
          state.output.filesDeleted.push(state.currentFileDeleted as FileDeleted);
          state.currentFileDeleted = null;
        }
        break;

      case 'package':
        if (state.currentPackage) {
          if (!state.output.packagesInstalled) {
            state.output.packagesInstalled = [];
          }
          state.output.packagesInstalled.push(state.currentPackage as PackageInstalled);
          state.currentPackage = null;
        }
        break;

      case 'server':
        if (state.currentServer) {
          if (!state.output.mcpSetup) {
            state.output.mcpSetup = [];
          }
          state.output.mcpSetup.push(state.currentServer as McpServerSetup);
          state.currentServer = null;
        }
        break;

      case 'search':
        if (state.currentSearch) {
          if (!state.output.webSearches) {
            state.output.webSearches = [];
          }
          state.output.webSearches.push(state.currentSearch as WebSearchPerformed);
          state.currentSearch = null;
        }
        break;

      case 'tool':
        if (state.currentTool) {
          if (!state.output.toolCalls) {
            state.output.toolCalls = [];
          }
          state.output.toolCalls.push(state.currentTool as ToolCallSummary);
          state.currentTool = null;
        }
        break;

      case 'url':
        if (state.currentUrl) {
          state.currentUrl.url = text;
          if (!state.output.previewUrls) {
            state.output.previewUrls = [];
          }
          state.output.previewUrls.push(state.currentUrl as PreviewUrl);
          state.currentUrl = null;
        }
        break;

      case 'note':
        if (state.currentNote) {
          state.currentNote.message = text;
          if (!state.output.notes) {
            state.output.notes = [];
          }
          state.output.notes.push(state.currentNote as OutputNote);
          state.currentNote = null;
        }
        break;
    }

    state.currentElement = null;
    state.textBuffer = '';
  };

  parser.ontext = (text) => {
    state.textBuffer += text;
  };

  parser.oncdata = (cdata) => {
    state.textBuffer += cdata;
  };

  try {
    parser.write(xmlContent).close();
  } catch (err) {
    console.error('[Overture] XML parse error:', err);
  }

  // If we got some valid data, return it even if there was a parse error
  // This is more lenient - we extract what we can
  const hasData = Object.keys(state.output).length > 0;

  if (!hasData) {
    console.error('[Overture] No structured data extracted from output');
    return null;
  }

  // Store raw output for reference
  state.output.raw = output;

  console.error('[Overture] Extracted structured output:', Object.keys(state.output).filter(k => k !== 'raw').join(', '));

  return state.output;
}

/**
 * Checks if output contains structured XML.
 * More efficient than parsing if you just need to check.
 */
export function isStructuredOutput(output: string): boolean {
  return output.includes('<execution_output>') && output.includes('</execution_output>');
}
