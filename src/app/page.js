"use client"
import { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, Clock, BookOpen, GraduationCap, Download, X, Loader2, Pencil } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import jsPDF from 'jspdf'
import { saveData, loadData } from '../utils/indexedDB';
import { useDropzone } from 'react-dropzone'
import { createWorker } from 'tesseract.js'

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function DailySchedule({ subjects }) {
  console.log('DailySchedule:', subjects.length, subjects)
  const sortedSubjects = [...subjects].sort((a, b) => a.time.localeCompare(b.time))

  const subjectsByDay = daysOfWeek.reduce((acc, day) => {
    acc[day] = sortedSubjects.filter(subject => subject.days.includes(day))
    return acc
  }, {})

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {daysOfWeek.map(day => {
        const daySubjects = subjectsByDay[day]
        if (daySubjects.length === 0) return null

        return (
          <Card key={day}>
            <CardHeader>
              <CardTitle className="capitalize">{day}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {daySubjects.map(subject => (
                  <li key={subject.id} className="p-2 bg-gray-100 rounded">
                    <p className="font-medium">{subject.name}</p>
                    <p className="text-sm text-gray-600">
                      {subject.teacher} - {subject.time}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ImageUploader({ setFromImg }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const worker = await createWorker("eng");

      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();

      console.log("OCR Text:", text); // Debugging extracted text

      // Parse the OCR text
      const lines = text.split("\n").filter((line) => line.trim());
      // console.log("Lines:", lines); // Debugging split lines
      const parsedData = [];
      const subjectName = lines[1];
      // console.log("SubjectName:", subjectName); // Debugging subject
      
      
      lines.forEach((line) => {
        // Match day, time, and location
        const scheduleMatch = line.match(
          /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{2}:\d{2})-(\d{2}:\d{2})\s+(.+)/i
        );

        // console.log("Schedule Match:", scheduleMatch);

        if (scheduleMatch) {
         let day = scheduleMatch[1].toLowerCase();
          const startTime = scheduleMatch[2];
          const endTime = scheduleMatch[3];
          const location = scheduleMatch[4];

          // Push validated time values
         
          
          parsedData.push({
            id: Date.now().toString(),
            name: subjectName, // Placeholder for OCR subject
            teacher: 'Unknown', // Placeholder for teacher name
            time: startTime,
            days: [day],
          });
        }
      });

      // console.log("Parsed Data:", parsedData);

      if (parsedData.length > 0) {
        setFromImg(parsedData);
        // console.log("Final Subject:", subjectName); // Debug final subject
      } else {
        setError(
          "No subjects could be extracted from the image. Please check the image format."
        );
      }
    } catch (err) {
      console.error("OCR Error:", err);
      setError("Error processing image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [setFromImg]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    multiple: false
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300'}`}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Processing image...</p>
          </div>
        ) : (
          <p>{isDragActive ? 'Drop the image here' : 'Drag & drop a timetable image, or click to select'}</p>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}


export default function StudentScheduleManager() {
  const [view, setView] = useState('weekly')
  const [subjects, setSubjects] = useState([])
  const [fromImg , setFromImg] = useState([]) // form image upload
  const [exams, setExams] = useState([])
  const [newSubject, setNewSubject] = useState({
    name: '',
    teacher: '',
    days: [], // array of selected days
    times: {} // { monday: '09:00', tuesday: '10:00', ... }
  })
  const [newExam, setNewExam] = useState({
    name: '',
    date: '',
    time: '',
    location: ''
  })
  const [editSubjectId, setEditSubjectId] = useState(null);
  const [editSubject, setEditSubject] = useState({ name: '', teacher: '', time: '', days: [] });
  // Change attendance state to use subject name as key
  const [attendance, setAttendance] = useState({}); // { [subjectName]: { attended: number, total: number } }
  const [showAttendancePopup, setShowAttendancePopup] = useState(false);
  const [popupSubject, setPopupSubject] = useState(null);
  // Add state for confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, subject: null });
  const [shownAttendancePopups, setShownAttendancePopups] = useState(new Set());
  // Add state for editing attendance
  const [editAttendanceSubject, setEditAttendanceSubject] = useState(null);
  const [editAttendanceValue, setEditAttendanceValue] = useState(0);

  const scheduleRef = useRef(null)

  const addFromImgToSubjects = () => {
    // Transform the `fromImg` data to match the structure of a subject
    const transformedSubjects = fromImg.map((item) => ({
      id:  Math.random().toString(36).substring(7), // Generate a unique ID if none exists
      name: item.name || 'Unknown Name', // Fallback if `name` is missing
      teacher: item.teacher || 'Unknown Teacher', // Fallback for `teacher`
      time: item.time || '00:00', // Fallback for `time`
      days: item.days || [], // Fallback to an empty array if `days` is undefined
    }));
  
    // Append to the existing `subjects` state
    setSubjects((prevSubjects) => [...prevSubjects, ...transformedSubjects]);
  };
  useEffect(() => {
    if (fromImg.length > 0) {
      addFromImgToSubjects();
    }
  }, [fromImg]);
    

  useEffect(() => {
    loadFromIndexedDB();
  }, [])

  useEffect(() => {
    saveToIndexedDB();
  }, [subjects, exams, attendance])

  // Show popup before class time (1 min before)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const day = daysOfWeek[now.getDay() - 1]; // 0=Sunday
      const currentTime = now.toTimeString().slice(0,5);
      subjects.forEach(subject => {
        if (subject.days.includes(day) && subject.time) {
          // 1 min before class
          const [h, m] = subject.time.split(':');
          const classDate = new Date(now);
          classDate.setHours(Number(h), Number(m)-1, 0, 0);
          const popupKey = `${subject.name}|${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}|${subject.time}`;
          if (
            now.getFullYear() === classDate.getFullYear() &&
            now.getMonth() === classDate.getMonth() &&
            now.getDate() === classDate.getDate() &&
            now.getHours() === classDate.getHours() &&
            now.getMinutes() === classDate.getMinutes() &&
            !shownAttendancePopups.has(popupKey)
          ) {
            setPopupSubject(subject);
            setShowAttendancePopup(true);
            setShownAttendancePopups(prev => new Set(prev).add(popupKey));
          }
        }
      });
    }, 1000 * 30); // check every 30s
    return () => clearInterval(interval);
  }, [subjects, shownAttendancePopups]);

  const markAttendance = (subjectId, attended) => {
    // Find the subject by id to get its name
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    setAttendance(prev => {
      const prevData = prev[subject.name] || { attended: 0, total: 42 };
      return {
        ...prev,
        [subject.name]: {
          attended: attended ? Math.min(prevData.attended + 1, 42) : prevData.attended,
          total: 42
        }
      };
    });
    setShowAttendancePopup(false);
    setPopupSubject(null);
  };

  const saveToIndexedDB = async () => {
    const data = {
      subjects,
      exams,
      attendance,
      timestamp: Date.now()
    }
    await saveData(data);
  }

  const loadFromIndexedDB = async () => {
    try {
      const data = await loadData();
      if (data) {
        const { subjects, exams, attendance: loadedAttendance, timestamp } = data;
        const currentTime = Date.now();
        if (currentTime - timestamp < 6 * 30 * 24 * 60 * 60 * 1000) { // 6 months in milliseconds
          setSubjects(subjects);
          setExams(exams);
          setAttendance(loadedAttendance || {});
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  const handleSubjectChange = (e) => {
    const { name, value } = e.target
    setNewSubject(prev => ({ ...prev, [name]: value }))
  }

  const handleSubjectDayChange = (day) => {
    setNewSubject(prev => {
      const days = prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day];
      return { ...prev, days };
    });
  };

  const handleSubjectTimeChange = (day, value) => {
    setNewSubject(prev => ({
      ...prev,
      times: { ...prev.times, [day]: value }
    }));
  };

  const addSubject = (event) => {
    event.preventDefault();
    const { name, teacher, days, times } = newSubject;
    const newSubjects = days.map(day => ({
      id: Date.now().toString() + '-' + day,
      name,
      teacher,
      days: [day],
      time: times[day] || '',
    }));
    setSubjects(prev => [...prev, ...newSubjects]);
    setNewSubject({ name: '', teacher: '', days: [], times: {} });
  };

  const removeSubject = (id) => {
    setSubjects(prev => prev.filter(subject => subject.id !== id))
  }

  const handleExamChange = (e) => {
    const { name, value } = e.target
    setNewExam(prev => ({ ...prev, [name]: value }))
  }

  const addExam = (event) => {
    event.preventDefault()
    const exam = {
      id: Date.now().toString(),
      ...newExam
    }
    setExams(prev => [...prev, exam])
    setNewExam({
      name: '',
      date: '',
      time: '',
      location: ''
    })
  }

  const removeExam = (id) => {
    setExams(prev => prev.filter(exam => exam.id !== id))
  }

  const startEditSubject = (subject) => {
    setEditSubjectId(subject.id);
    setEditSubject({ ...subject });
  };

  const cancelEditSubject = () => {
    setEditSubjectId(null);
    setEditSubject({ name: '', teacher: '', time: '', days: [] });
  };

  const handleEditSubjectChange = (e) => {
    const { name, value } = e.target;
    setEditSubject((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubjectDayChange = (day) => {
    setEditSubject((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  };

  const saveEditSubject = () => {
    setConfirmDialog({ open: true, action: 'save', subject: editSubject });
  };

  const handleSaveEditSubject = () => {
    setConfirmDialog({ open: true, action: 'save', subject: editSubject });
  };
  const handleRemoveSubject = (subject) => {
    setConfirmDialog({ open: true, action: 'delete', subject });
  };
  const handleCancelEditSubject = () => {
    setConfirmDialog({ open: true, action: 'cancel', subject: null });
  };

  const confirmAction = () => {
    if (confirmDialog.action === 'save') {
      setSubjects((prev) =>
        prev.map((subject) =>
          subject.id === editSubjectId ? { ...subject, ...editSubject } : subject
        )
      );
      setEditSubjectId(null);
      setEditSubject({ name: '', teacher: '', time: '', days: [] });
    } else if (confirmDialog.action === 'delete') {
      setSubjects((prev) => prev.filter(subject => subject.id !== confirmDialog.subject.id));
    } else if (confirmDialog.action === 'cancel') {
      setEditSubjectId(null);
      setEditSubject({ name: '', teacher: '', time: '', days: [] });
    }
    setConfirmDialog({ open: false, action: null, subject: null });
  };
  const closeDialog = () => setConfirmDialog({ open: false, action: null, subject: null });

  const downloadPDF = () => {
    const pdf = new jsPDF()
    pdf.text("Student Schedule", 20, 20)

    let yOffset = 40

    // Add subjects to PDF
    pdf.setFontSize(16)
    pdf.text("Subjects", 20, yOffset)
    yOffset += 10

    pdf.setFontSize(12)
    subjects.forEach((subject, index) => {
      pdf.text(`${index + 1}. ${subject.name}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Teacher: ${subject.teacher}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Days: ${subject.days.join(', ')}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Time: ${subject.time}`, 20, yOffset)
      yOffset += 10

      if (yOffset > 270) {
        pdf.addPage()
        yOffset = 20
      }
    })

    yOffset += 10

    // Add exams to PDF
    pdf.setFontSize(16)
    pdf.text("Exams", 20, yOffset)
    yOffset += 10

    pdf.setFontSize(12)
    exams.forEach((exam, index) => {
      pdf.text(`${index + 1}. ${exam.name}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Date: ${exam.date}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Time: ${exam.time}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Location: ${exam.location}`, 20, yOffset)
      yOffset += 10

      if (yOffset > 270) {
        pdf.addPage()
        yOffset = 20
      }
    })

    pdf.save("student_schedule.pdf")
  }

  return (
    <div className="min-h-screen p-4 bg-gray-100 text-gray-900">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Student Schedule Manager</h1>
        <div className="flex items-center space-x-4">
          <Button onClick={downloadPDF}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </header>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <div className="flex justify-between items-center">
         
          </div>
          <div className="bg-white p-4 rounded-lg shadow" ref={scheduleRef}>
            <h3 className="text-lg font-semibold mb-4">Schedule View ({view})</h3>
            <DailySchedule subjects={subjects} />
            <div className="mt-4">
              <h4 className="font-medium mb-2">Exams</h4>
              <ul className="space-y-2">
                {exams.map((exam) => (
                  <li key={exam.id} className="p-2 bg-gray-100 rounded">
                    <p className="font-medium">{exam.name}</p>
                    <p className="text-sm text-gray-600">
                      {exam.date} at {exam.time} - {exam.location}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Import Timetable</h3>
            <ImageUploader setFromImg={setFromImg} />
          </div>
          
          <form onSubmit={addSubject} className="space-y-4">
            <Input
              type="text"
              name="name"
              placeholder="Subject Name"
              value={newSubject.name}
              onChange={e => setNewSubject(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <Input
              type="text"
              name="teacher"
              placeholder="Location Name"
              value={newSubject.teacher}
              onChange={e => setNewSubject(prev => ({ ...prev, teacher: e.target.value }))}
              required
            />
            <div className="space-y-2">
              <Label>Days & Times</Label>
              <div className="flex flex-wrap gap-4">
                {daysOfWeek.map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day}`}
                      checked={newSubject.days.includes(day)}
                      onCheckedChange={() => handleSubjectDayChange(day)}
                    />
                    <Label htmlFor={`day-${day}`}>{day.charAt(0).toUpperCase() + day.slice(1)}</Label>
                    {newSubject.days.includes(day) && (
                      <Input
                        type="time"
                        value={newSubject.times[day] || ''}
                        onChange={e => handleSubjectTimeChange(day, e.target.value)}
                        required
                        className="w-28"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Button type="submit">
              <BookOpen className="mr-2 h-4 w-4" /> Add Subject
            </Button>
          </form>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Subject List</h3>
            {subjects.length === 0 ? (
              <p className="text-center text-gray-500">No subjects added yet.</p>
            ) : (
              <ul className="space-y-2">
                {subjects.map((subject) => (
                  <li key={subject.id} className="flex justify-between items-center p-2 bg-gray-100 rounded">
                    {editSubjectId === subject.id ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <Input
                          type="text"
                          name="name"
                          placeholder="Subject Name"
                          value={editSubject.name}
                          onChange={handleEditSubjectChange}
                          required
                        />
                        <Input
                          type="text"
                          name="teacher"
                          placeholder="Teacher Name"
                          value={editSubject.teacher}
                          onChange={handleEditSubjectChange}
                          required
                        />
                        <Input
                          type="time"
                          name="time"
                          value={editSubject.time}
                          onChange={handleEditSubjectChange}
                          required
                        />
                        <div className="space-y-2">
                          <Label>Days</Label>
                          <div className="flex flex-wrap gap-2">
                            {daysOfWeek.map((day) => (
                              <div key={day} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-day-${day}`}
                                  checked={editSubject.days.includes(day)}
                                  onCheckedChange={() => handleEditSubjectDayChange(day)}
                                />
                                <Label htmlFor={`edit-day-${day}`}>{day.charAt(0).toUpperCase() + day.slice(1)}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button variant="default" size="sm" onClick={handleSaveEditSubject}>
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" onClick={handleCancelEditSubject}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="font-medium">{subject.name}</p>
                          <p className="text-sm text-gray-600">
                            {subject.teacher} - {subject.days.join(', ')} at {subject.time}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditSubject(subject)}
                            aria-label={`Edit ${subject.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSubject(subject)}
                            aria-label={`Remove ${subject.name}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="exams" className="space-y-4">
          <form onSubmit={addExam} className="space-y-4">
            <Input
              type="text"
              name="name"
              placeholder="Exam Name"
              value={newExam.name}
              onChange={handleExamChange}
              required
            />
            <Input
              type="date"
              name="date"
              value={newExam.date}
              onChange={handleExamChange}
              required
            />
            <Input
              type="time"
              name="time"
              value={newExam.time}
              onChange={handleExamChange}
              required
            />
            <Input
              type="text"
              name="location"
              placeholder="Location"
              value={newExam.location}
              onChange={handleExamChange}
              required
            />
            <Button type="submit">
              <GraduationCap className="mr-2 h-4 w-4" /> Add Exam
            </Button>
          </form>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Exam List</h3>
            {exams.length === 0 ? (
              <p className="text-center text-gray-500">No exams added yet.</p>
            ) : (
              <ul className="space-y-2">
                {exams.map((exam) => (
                  <li key={exam.id} className="flex justify-between items-center p-2 bg-gray-100 rounded">
                    <div>
                      <p className="font-medium">{exam.name}</p>
                      <p className="text-sm text-gray-600">
                        {exam.date} at {exam.time} - {exam.location}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExam(exam.id)}
                      aria-label={`Remove ${exam.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <h3 className="text-lg font-semibold mb-4">Attendance</h3>
          {subjects.length === 0 ? (
            <p className="text-center text-gray-500">No subjects added yet.</p>
          ) : (
            <ul className="space-y-2">
              {/* Group subjects by name */}
              {Array.from(new Set(subjects.map(s => s.name))).map(subjectName => {
                const att = attendance[subjectName] || { attended: 0, total: 42 };
                const percent = att.total > 0 ? Math.round((att.attended / att.total) * 100) : 0;
                const remaining = Math.max(0, Math.ceil(0.75 * att.total) - att.attended);
                return (
                  <li key={subjectName} className="p-2 bg-gray-100 rounded flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{subjectName}</p>
                      <p className="text-sm text-gray-600">Attended: {att.attended} / {att.total} ({percent}%)</p>
                      <p className="text-sm text-gray-600">Remaining for 75%: {remaining}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 md:mt-0">
                      {editAttendanceSubject === subjectName ? (
                        <>
                          <input
                            type="number"
                            min={0}
                            max={att.total}
                            value={editAttendanceValue}
                            onChange={e => setEditAttendanceValue(Math.max(0, Math.min(att.total, Number(e.target.value))))}
                            className="w-16 px-2 py-1 rounded border border-gray-300 text-sm"
                          />
                          <Button size="sm" onClick={() => {
                            setAttendance(prev => ({
                              ...prev,
                              [subjectName]: { ...att, attended: editAttendanceValue }
                            }));
                            setEditAttendanceSubject(null);
                          }}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditAttendanceSubject(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditAttendanceSubject(subjectName);
                          setEditAttendanceValue(att.attended);
                        }}>Edit</Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
      {showAttendancePopup && popupSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Attendance Check</h2>
            <p className="mb-2">Class: <span className="font-medium">{popupSubject.name}</span></p>
            <p className="mb-2">Location: <span className="font-medium">{popupSubject.teacher}</span></p>
            <p className="mb-4">Time: <span className="font-medium">{popupSubject.time}</span></p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => markAttendance(popupSubject.id, true)} variant="default">YES</Button>
              <Button onClick={() => markAttendance(popupSubject.id, false)} variant="destructive">NO</Button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Confirm {confirmDialog.action === 'save' ? 'Save' : confirmDialog.action === 'delete' ? 'Delete' : 'Cancel'}?</h2>
            <p className="mb-4">Are you sure you want to {confirmDialog.action} {confirmDialog.action === 'delete' && confirmDialog.subject ? confirmDialog.subject.name : ''}?</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={confirmAction} variant="default">YES</Button>
              <Button onClick={closeDialog} variant="destructive">NO</Button>
            </div>
          </div>
        </div>
      )}
      <footer><p className='text-center text-gray-500 py-2'>Created by Anish Kumar Singh</p></footer>
    </div>
  )
}

