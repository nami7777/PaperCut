
import { QuestionEntry, Folder, Lesson } from '../types';

const DB_NAME = 'PaperCutDB';
const DB_VERSION = 4;
const STORE_QUESTIONS = 'questions';
const STORE_FOLDERS = 'folders';
const STORE_LESSONS = 'lessons';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_QUESTIONS)) {
        const store = db.createObjectStore(STORE_QUESTIONS, { keyPath: 'id' });
        store.createIndex('year', 'year', { unique: false });
        store.createIndex('subject', 'subject', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        const store = db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
        store.createIndex('subject', 'subject', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_LESSONS)) {
        const store = db.createObjectStore(STORE_LESSONS, { keyPath: 'id' });
        store.createIndex('subject', 'subject', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

/**
 * Pure function to map lessons to a question based on rules.
 */
const mapLessonsToQuestion = (question: QuestionEntry, lessons: Lesson[]): QuestionEntry => {
  // Use a Set to avoid duplicates, start with existing topics if any
  const matchedTopics = new Set(question.topics);
  const cleanOcr = (question.ocrText || "").toLowerCase();
  const questionKws = (question.keywords || []).map(k => k.toLowerCase());

  lessons.forEach(lesson => {
    // 1. Keyword Check: Does any trigger keyword match the question's keywords?
    const hasKeywordMatch = (lesson.triggerKeywords || []).some(tk => 
      questionKws.includes(tk.toLowerCase())
    );

    // 2. OCR Phrase Check: Does the OCR text contain any of the trigger phrases?
    const hasOcrMatch = (lesson.triggerOcrPhrases || []).some(tp => 
      tp.trim() !== "" && cleanOcr.includes(tp.toLowerCase())
    );

    if (hasKeywordMatch || hasOcrMatch) {
      matchedTopics.add(lesson.name);
    }
  });

  return {
    ...question,
    topics: Array.from(matchedTopics)
  };
};

export const applyLessonMappings = async (question: QuestionEntry): Promise<QuestionEntry> => {
  const lessons = await getLessonsBySubject(question.subject);
  return mapLessonsToQuestion(question, lessons);
};

// --- Questions ---

export const saveQuestion = async (question: QuestionEntry): Promise<void> => {
  const processed = await applyLessonMappings(question);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_QUESTIONS);
    const request = store.put(processed);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const bulkSaveQuestions = async (questions: QuestionEntry[]): Promise<void> => {
  if (questions.length === 0) return;
  
  const subject = questions[0].subject;
  const lessons = await getLessonsBySubject(subject);
  const processed = questions.map(q => mapLessonsToQuestion(q, lessons));

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_QUESTIONS);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    processed.forEach(q => store.put(q));
  });
};

export const getAllQuestions = async (): Promise<QuestionEntry[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readonly');
    const store = transaction.objectStore(STORE_QUESTIONS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as QuestionEntry[]);
    request.onerror = () => reject(request.error);
  });
};

export const getQuestionsBySubject = async (subject: string): Promise<QuestionEntry[]> => {
  const all = await getAllQuestions();
  return all.filter(q => q.subject === subject).sort((a, b) => b.createdAt - a.createdAt);
};

export const deleteQuestion = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_QUESTIONS);
    store.delete(id).onsuccess = () => resolve();
  });
};

export const updateQuestionMetadata = async (id: string, updates: { keywords?: string[], topics?: string[] }): Promise<void> => {
  const db = await openDB();
  const q = await new Promise<QuestionEntry | undefined>((resolve, reject) => {
      const tx = db.transaction([STORE_QUESTIONS], 'readonly');
      const req = tx.objectStore(STORE_QUESTIONS).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
  });

  if (!q) throw new Error("Question not found");

  if (updates.keywords !== undefined) q.keywords = updates.keywords;
  if (updates.topics !== undefined) q.topics = updates.topics;
  const processed = await applyLessonMappings(q);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_QUESTIONS);
    const request = store.put(processed);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const updateQuestionStatus = async (id: string, status: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
        const store = transaction.objectStore(STORE_QUESTIONS);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const q = getReq.result as QuestionEntry;
            if (q) {
                q.userStatus = status as any;
                store.put(q);
            }
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const reprocessSubjectMapping = async (subject: string): Promise<void> => {
    const questions = await getQuestionsBySubject(subject);
    if (questions.length > 0) {
        await bulkSaveQuestions(questions);
    }
};

export const deleteSubjectData = async (subject: string): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction([STORE_QUESTIONS, STORE_FOLDERS, STORE_LESSONS], 'readwrite');
  [STORE_QUESTIONS, STORE_FOLDERS, STORE_LESSONS].forEach(sName => {
      const store = transaction.objectStore(sName);
      const index = store.index('subject');
      index.openCursor(IDBKeyRange.only(subject)).onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) { cursor.delete(); cursor.continue(); }
      };
  });
};

export const getAllUniqueKeywords = async (subject?: string): Promise<string[]> => {
  const qs = subject ? await getQuestionsBySubject(subject) : await getAllQuestions();
  const set = new Set<string>();
  qs.forEach(q => q.keywords.forEach(k => set.add(k)));
  return Array.from(set);
};

export const getAllUniqueTopics = async (subject?: string): Promise<string[]> => {
  const qs = subject ? await getQuestionsBySubject(subject) : await getAllQuestions();
  const set = new Set<string>();
  qs.forEach(q => q.topics.forEach(t => set.add(t)));
  return Array.from(set);
};

// --- Folders ---

export const saveFolder = async (folder: Folder): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction([STORE_FOLDERS], 'readwrite');
  transaction.objectStore(STORE_FOLDERS).put(folder);
};

export const getAllFolders = async (): Promise<Folder[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FOLDERS], 'readonly');
    const store = transaction.objectStore(STORE_FOLDERS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as Folder[]);
    request.onerror = () => reject(request.error);
  });
};

export const getFoldersBySubject = async (subject: string): Promise<Folder[]> => {
  const db = await openDB();
  const transaction = db.transaction([STORE_FOLDERS], 'readonly');
  return new Promise((resolve) => {
    transaction.objectStore(STORE_FOLDERS).index('subject').getAll(subject).onsuccess = (e: any) => resolve(e.target.result);
  });
};

export const deleteFolder = async (id: string): Promise<void> => {
  const db = await openDB();
  db.transaction([STORE_FOLDERS], 'readwrite').objectStore(STORE_FOLDERS).delete(id);
};

// --- Lessons ---

export const saveLesson = async (lesson: Lesson): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction([STORE_LESSONS], 'readwrite');
  transaction.objectStore(STORE_LESSONS).put(lesson);
};

export const getLessonsBySubject = async (subject: string): Promise<Lesson[]> => {
  const db = await openDB();
  const transaction = db.transaction([STORE_LESSONS], 'readonly');
  return new Promise((resolve) => {
      const store = transaction.objectStore(STORE_LESSONS);
      const index = store.index('subject');
      index.getAll(subject).onsuccess = (e: any) => resolve(e.target.result || []);
  });
};

export const deleteLesson = async (id: string): Promise<void> => {
  const db = await openDB();
  db.transaction([STORE_LESSONS], 'readwrite').objectStore(STORE_LESSONS).delete(id);
};

export const getFewShotExamples = async (subject: string, limit: number): Promise<QuestionEntry[]> => {
  const all = await getQuestionsBySubject(subject);
  return all
    .filter(q => q.ocrText && q.keywords && q.keywords.length > 0)
    .slice(0, limit);
};
