import { BookOpen } from "lucide-react";
import Markdown from "react-markdown";

interface NotebookViewerProps {
  notebookContent: string | null;
}

export default function NotebookViewer({ notebookContent }: NotebookViewerProps) {
  let cells: any[] = [];
  
  try {
    if (notebookContent) {
      const parsed = JSON.parse(notebookContent);
      cells = parsed.cells || [];
    }
  } catch (err) {
    console.error("Failed to parse notebook JSON:", err);
  }

  if (cells.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-slate-200 rounded-xl h-[400px]">
        <BookOpen size={32} className="text-slate-400 mb-2" />
        <p className="text-slate-500 text-sm font-medium">Notebook content could not be loaded or parsed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6 bg-white border border-slate-200 rounded-xl shadow-sm h-[650px] overflow-y-auto">
      {/* Notebook Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4 mb-4">
        <span className="text-indigo-600">
          <BookOpen size={20} />
        </span>
        <h3 className="font-mono text-sm font-semibold text-slate-800">Stock_Analysis.ipynb</h3>
        <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200/60 px-2 py-0.5 rounded font-mono">Python 3 (ipykernel)</span>
      </div>

      {cells.map((cell, idx) => {
        const source = Array.isArray(cell.source) ? cell.source.join("") : cell.source || "";
        const cellType = cell.cell_type;

        if (cellType === "markdown") {
          return (
            <div key={idx} className="prose prose-slate max-w-none text-slate-800 leading-relaxed py-2">
              <Markdown>{source}</Markdown>
            </div>
          );
        } else if (cellType === "code") {
          return (
            <div key={idx} className="space-y-2 font-mono text-xs">
              {/* Input Code Block */}
              <div className="relative rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                <div className="absolute left-2 top-2 text-[10px] text-slate-400 select-none font-semibold">
                  In [{cell.execution_count || " "}]:
                </div>
                <pre className="p-4 pl-12 text-slate-800 whitespace-pre overflow-x-auto">
                  <code>{source}</code>
                </pre>
              </div>

              {/* Output Blocks if any */}
              {cell.outputs && cell.outputs.length > 0 && (
                <div className="pl-6 border-l-2 border-slate-200 space-y-1.5">
                  {cell.outputs.map((out: any, oIdx: number) => {
                    const text = Array.isArray(out.text)
                      ? out.text.join("")
                      : out.data?.["text/plain"]
                      ? Array.isArray(out.data["text/plain"])
                        ? out.data["text/plain"].join("")
                        : out.data["text/plain"]
                      : out.traceback
                      ? out.traceback.join("\n")
                      : "";

                    if (text) {
                      return (
                        <div key={oIdx} className="bg-slate-50 border border-slate-100 rounded p-2.5 text-slate-600 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                          {text}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
