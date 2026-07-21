import { useState, useEffect } from "react";
import { Folder, File, ChevronDown, ChevronRight, Copy, Check, Download, ExternalLink } from "lucide-react";
import { ProjectFile } from "../types";

interface RepositoryExplorerProps {
  tree: ProjectFile[];
  loading: boolean;
  onRefresh: () => void;
}

export default function RepositoryExplorer({ tree, loading, onRefresh }: RepositoryExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({
    "": true, // Root
  });

  // Automatically select the first file (usually README.md or main.py) on load
  useEffect(() => {
    if (tree.length > 0 && !selectedFile) {
      // Find README.md or the first file
      const readme = tree.find((f) => f.name.toLowerCase() === "readme.md");
      if (readme) {
        setSelectedFile(readme);
      } else {
        const findFirstFile = (nodes: ProjectFile[]): ProjectFile | null => {
          for (const node of nodes) {
            if (node.type === "file") return node;
            if (node.children) {
              const f = findFirstFile(node.children);
              if (f) return f;
            }
          }
          return null;
        };
        const firstFile = findFirstFile(tree);
        if (firstFile) setSelectedFile(firstFile);
      }
    }
  }, [tree, selectedFile]);

  const toggleDirectory = (path: string) => {
    setExpandedDirs((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const handleCopy = () => {
    if (!selectedFile?.content) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderTree = (nodes: ProjectFile[], depth = 0) => {
    return nodes.map((node) => {
      const isDir = node.type === "directory";
      const isExpanded = expandedDirs[node.path];
      const isSelected = selectedFile?.path === node.path;

      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => {
              if (isDir) {
                toggleDirectory(node.path);
              } else {
                setSelectedFile(node);
              }
            }}
            className={`flex items-center py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm ${
              isSelected
                ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {isDir ? (
              <>
                <span className="mr-1 text-slate-400">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <span className="mr-2 text-amber-500">
                  <Folder size={16} />
                </span>
              </>
            ) : (
              <>
                <span className="w-5" /> {/* Chevron placeholder */}
                <span className="mr-2 text-indigo-500">
                  <File size={16} />
                </span>
              </>
            )}
            <span className="font-mono truncate">{node.name}</span>
          </div>

          {isDir && isExpanded && node.children && (
            <div className="mt-0.5">{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[650px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* File Explorer Sidebar */}
      <div className="lg:col-span-1 border-r border-slate-200 bg-slate-50 p-4 flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Repository Structure</h3>
          <button
            onClick={() => {
              window.open("/api/download-zip", "_blank");
            }}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-2.5 rounded transition-colors shadow-sm cursor-pointer"
          >
            <Download size={12} /> Download ZIP
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-xs text-slate-400">Reading filesystem...</p>
          </div>
        ) : (
          <div className="flex-1 space-y-1">{renderTree(tree)}</div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-200 text-slate-400 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1 font-semibold">
            <ExternalLink size={11} /> Project Stack
          </div>
          Python 3 • Pandas • NumPy • Matplotlib • Seaborn • Plotly • yfinance
        </div>
      </div>

      {/* Code Editor / File Viewer */}
      <div className="lg:col-span-3 flex flex-col bg-slate-50 h-full overflow-hidden">
        {selectedFile ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-indigo-600">
                  <File size={16} />
                </span>
                <span className="font-mono text-sm text-slate-700 font-semibold">{selectedFile.path}</span>
              </div>
              {selectedFile.content !== undefined && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 bg-white px-2.5 py-1 rounded-md cursor-pointer shadow-xs"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-indigo-600" />
                      <span className="text-indigo-600 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Code Body */}
            <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-800 leading-relaxed bg-white">
              {selectedFile.content ? (
                <div className="flex">
                  {/* Line numbers */}
                  <div className="text-right text-slate-400 select-none pr-4 border-r border-slate-200 mr-4 font-mono w-10">
                    {selectedFile.content.split("\n").map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  {/* Code */}
                  <pre className="text-left overflow-x-auto whitespace-pre tab-size-4 flex-1 text-slate-800 font-mono">
                    <code>{selectedFile.content}</code>
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p>Binary or non-text file content.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white">
            <File size={32} className="mb-2 text-slate-300" />
            <p className="text-sm">Select a file from the explorer to view its contents.</p>
          </div>
        )}
      </div>
    </div>
  );
}
