"use client"
import { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, Clock, BookOpen, GraduationCap, Download, X, Loader2 } from 'lucide-react'
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
    time: '',
    days: [] 
  })
  const [newExam, setNewExam] = useState({
    name: '',
    date: '',
    time: '',
    location: ''
  })

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
  }, [subjects, exams])

  const saveToIndexedDB = async () => {
    const data = {
      subjects,
      exams,
      timestamp: Date.now()
    }
    await saveData(data);
  }

  const loadFromIndexedDB = async () => {
    try {
      const data = await loadData();
      if (data) {
        const { subjects, exams, timestamp } = data;
        const currentTime = Date.now();
        if (currentTime - timestamp < 6 * 30 * 24 * 60 * 60 * 1000) { // 6 months in milliseconds
          setSubjects(subjects);
          
          setExams(exams);
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
    setNewSubject(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }))
  }

  const addSubject = (event) => {
    event.preventDefault()
    const subject = {
      id: Date.now().toString(),
      ...newSubject
    }
    setSubjects(prev => [...prev, subject])
    
    setNewSubject({
      name: '',
      teacher: '',
      time: '',
      days: []
    })
  }

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
              onChange={handleSubjectChange}
              required
            />
            <Input
              type="text"
              name="teacher"
              placeholder="Teacher Name"
              value={newSubject.teacher}
              onChange={handleSubjectChange}
              required
            />
            <Input
              type="time"
              name="time"
              value={newSubject.time}
              onChange={handleSubjectChange}
              required
            />
            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day}`}
                      checked={newSubject.days.includes(day)}
                      onCheckedChange={() => handleSubjectDayChange(day)}
                    />
                    <Label htmlFor={`day-${day}`}>{day.charAt(0).toUpperCase() + day.slice(1)}</Label>
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
                    <div>
                      <p className="font-medium">{subject.name}</p>
                      <p className="text-sm text-gray-600">
                        {subject.teacher} - {subject.days.join(', ')} at {subject.time}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSubject(subject.id)}
                      aria-label={`Remove ${subject.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
      </Tabs>
      <footer><p className='text-center text-gray-500 py-2'>Created by Anish Kumar Singh</p></footer>
    </div>
  )
}

