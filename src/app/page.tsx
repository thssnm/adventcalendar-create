"use client";

import React, { useState, useEffect, useCallback } from "react";

// TypeScript Interfaces
interface AdventText {
  id?: number;
  text_number: number;
  title: string;
  content: string;
  created_at?: string;
  updated_at: string;
}

interface TextsState {
  [key: number]: AdventText;
}

// Supabase Konfiguration (ersetze mit deinen Werten)
const SUPABASE_URL: string = "https://ccxkyyvevkwsozvsuxry.supabase.co";
const SUPABASE_KEY: string =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGt5eXZldmt3c296dnN1eHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4OTA2NzUsImV4cCI6MjA3MjQ2NjY3NX0.eaMKMzgc5oqrEHyrRP6w8Ed0cfqAH_z4a2ytj_Fx-ao";

export default function MarkdownEditor(): JSX.Element {
  const [currentText, setCurrentText] = useState<number>(1);
  const [content, setContent] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [texts, setTexts] = useState<TextsState>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // API Hilfsfunktionen - kein any mehr!
  const supabaseRequest = async <T = Record<string, unknown>,>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    endpoint: string,
    body: Record<string, unknown> | null = null,
    extraHeaders: Record<string, string> = {}
  ): Promise<T> => {
    const config: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        ...extraHeaders,
      },
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1${endpoint}`,
        config
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Prüfe ob Antwort leer ist (bei POST/PUT/DELETE ohne Return)
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      console.error("Supabase request error:", error);
      throw error;
    }
  };

  // loadAllTexts mit useCallback für useEffect dependency
  const loadAllTexts = useCallback(async (): Promise<void> => {
    try {
      const data = await supabaseRequest<AdventText[]>(
        "GET",
        "/adventcalendar?select=*&order=text_number"
      );

      const textsObj: TextsState = {};
      data.forEach((text: AdventText) => {
        textsObj[text.text_number] = text;
      });
      setTexts(textsObj);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
      alert("Fehler beim Laden der Texte");
    }
  }, []);

  // useEffect mit korrekter dependency
  useEffect(() => {
    loadAllTexts();
  }, [loadAllTexts]);

  // Lade aktuellen Text wenn sich die Auswahl ändert
  useEffect(() => {
    if (texts[currentText]) {
      setContent(texts[currentText].content || "");
      setTitle(texts[currentText].title || `Text ${currentText}`);
    } else {
      setContent("");
      setTitle(`Text ${currentText}`);
    }
  }, [currentText, texts]);

  const saveText = async (): Promise<void> => {
    if (!content.trim() && !title.trim()) return;

    setSaving(true);
    try {
      const textData: Omit<AdventText, "id" | "created_at"> = {
        text_number: currentText,
        title: title,
        content: content,
        updated_at: new Date().toISOString(),
      };

      // Versuche zuerst zu updaten, falls das fehlschlägt, dann einfügen
      // updateError Variable entfernt!
      try {
        await supabaseRequest(
          "PATCH",
          `/adventcalendar?text_number=eq.${currentText}`,
          textData
        );
      } catch {
        // Falls Update fehlschlägt, versuche Insert
        await supabaseRequest("POST", "/adventcalendar", textData);
      }

      // Update local state
      setTexts((prev) => ({
        ...prev,
        [currentText]: textData as AdventText,
      }));

      setLastSaved(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern");
    }
    setSaving(false);
  };

  const deleteText = async (): Promise<void> => {
    if (!window.confirm(`Möchtest du Text ${currentText} wirklich löschen?`))
      return;

    setSaving(true);
    try {
      await supabaseRequest(
        "DELETE",
        `/adventcalendar?text_number=eq.${currentText}`
      );

      // Update local state
      setTexts((prev) => {
        const newTexts = { ...prev };
        delete newTexts[currentText];
        return newTexts;
      });

      // Reset current text
      setContent("");
      setTitle(`Text ${currentText}`);
      setLastSaved(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Fehler beim Löschen");
    }
    setSaving(false);
  };

  const exportAsMarkdown = (): void => {
    const markdownContent: string = `# ${title}\n\n${content}`;
    const blob = new Blob([markdownContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAllAsZip = async (): Promise<void> => {
    // Einfache Lösung: Alle als einzelne Downloads
    Object.values(texts).forEach((text: AdventText, index: number) => {
      setTimeout(() => {
        const markdownContent: string = `# ${text.title}\n\n${text.content}`;
        const blob = new Blob([markdownContent], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `text_${text.text_number}_${text.title
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase()}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }, index * 100);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-black mb-2">
            Markdown Text Editor
          </h1>
          <p className="text-gray-600">
            Erstelle und bearbeite deine 24 Texte im Markdown-Format
          </p>
        </header>

        {/* Text-Auswahl */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Text auswählen:
          </label>
          <div className="grid grid-cols-12 gap-2">
            {Array.from({ length: 24 }, (_, i) => i + 1).map((num: number) => (
              <button
                key={num}
                onClick={() => setCurrentText(num)}
                className={`p-2 rounded text-sm font-medium transition-colors ${
                  currentText === num
                    ? "bg-blue-600 text-white"
                    : texts[num]?.content
                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Seite */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">
                Editor - Text {currentText}
              </h2>
              {lastSaved && (
                <p className="text-xs text-gray-500 mt-1">
                  Zuletzt gespeichert: {lastSaved}
                </p>
              )}
            </div>
            <div className="p-4">
              <input
                type="text"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTitle(e.target.value)
                }
                placeholder="Titel eingeben..."
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
              />
              <textarea
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setContent(e.target.value)
                }
                placeholder="Hier deinen Markdown-Text eingeben...

Beispiele:
# Überschrift
## Unterüberschrift
**Fett** oder *kursiv*
- Liste
- Punkt 2

[Link](http://example.com)
"
                className="w-full h-96 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-black"
              />
            </div>
          </div>

          {/* Preview Seite */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">Vorschau</h2>
            </div>
            <div className="p-4 prose prose-sm max-w-none">
              {title && (
                <h1 className="text-2xl font-bold mb-4 text-black">{title}</h1>
              )}
              <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded text-black">
                {content || "Vorschau erscheint hier..."}
              </div>
            </div>
          </div>
        </div>

        {/* Aktionen */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={saveText}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Speichere..." : "Speichern"}
          </button>
          <button
            onClick={deleteText}
            disabled={saving || !texts[currentText]}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Löschen
          </button>
          <button
            onClick={exportAsMarkdown}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Als .md herunterladen
          </button>
          <button
            onClick={exportAllAsZip}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Alle Texte herunterladen
          </button>
          <button
            onClick={loadAllTexts}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Neu laden
          </button>
        </div>

        {/* Hilfe */}
        <div className="mt-8 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Markdown Hilfe:</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p>
              <code># Überschrift</code> → große Überschrift
            </p>
            <p>
              <code>## Unterüberschrift</code> → kleinere Überschrift
            </p>
            <p>
              <code>**fett**</code> → <strong>fett</strong>
            </p>
            <p>
              <code>*kursiv*</code> → <em>kursiv</em>
            </p>
            <p>
              <code>- Listenpunkt</code> → • Listenpunkt
            </p>
            <p>
              <code>[Link](http://example.com)</code> → anklickbarer Link
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
