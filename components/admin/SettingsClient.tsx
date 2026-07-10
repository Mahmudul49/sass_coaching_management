"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import {
  setAttendanceSms,
  updateCenterName,
  updateAdminName,
  changePassword,
} from "@/app/[tenant]/admin/actions/settings";

export default function SettingsClient({
  centerName,
  adminName,
  attendanceSmsEnabled,
}: {
  centerName: string;
  adminName: string;
  attendanceSmsEnabled: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  // Bilingual copy: English under the settings page's English provider, Bengali
  // under the global toggle elsewhere.
  const { locale } = useI18n();
  const en = locale === "en";
  const savedMsg = en ? "Settings saved." : "সেটিংস সংরক্ষিত হয়েছে।";
  const errMsg = en ? "Something went wrong." : "সমস্যা হয়েছে।";
  const saveLabel = en ? "Save" : "সংরক্ষণ";

  const [enabled, setEnabled] = useState(attendanceSmsEnabled);
  const [smsPending, startSms] = useTransition();

  const [center, setCenter] = useState(centerName);
  const [name, setName] = useState(adminName);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next);
    startSms(async () => {
      const res = await setAttendanceSms(next);
      if (res.ok) toast.success(savedMsg);
      else {
        setEnabled(!next);
        toast.error(res.error ?? errMsg);
      }
    });
  }

  function saveCenter() {
    start(async () => {
      const res = await updateCenterName(center);
      if (res.ok) {
        toast.success(en ? "Center name updated." : "সেন্টারের নাম আপডেট হয়েছে।");
        router.refresh();
      } else toast.error(res.error ?? errMsg);
    });
  }

  function saveName() {
    start(async () => {
      const res = await updateAdminName(name);
      if (res.ok) toast.success(en ? "Admin name updated." : "অ্যাডমিনের নাম আপডেট হয়েছে।");
      else toast.error(res.error ?? errMsg);
    });
  }

  function savePassword() {
    start(async () => {
      const res = await changePassword(cur, pw);
      if (res.ok) {
        toast.success(en ? "Password changed." : "পাসওয়ার্ড পরিবর্তন হয়েছে।");
        setCur("");
        setPw("");
      } else toast.error(res.error ?? errMsg);
    });
  }

  return (
    <Stack spacing={2}>
      {/* Center name */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {en ? "Center Name" : "সেন্টারের নাম"}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <TextField
              label={en ? "Center" : "সেন্টার"}
              value={center}
              onChange={(e) => setCenter(e.target.value)}
            />
            <Button onClick={saveCenter} disabled={pending || !center.trim() || center === centerName}>
              {saveLabel}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Admin name */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {en ? "Admin Name" : "অ্যাডমিনের নাম"}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <TextField
              label={en ? "Admin" : "অ্যাডমিন"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={saveName} disabled={pending || !name.trim() || name === adminName}>
              {saveLabel}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {en ? "Change Password" : "পাসওয়ার্ড পরিবর্তন"}
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              label={en ? "Current password" : "বর্তমান পাসওয়ার্ড"}
              type="password"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              autoComplete="current-password"
            />
            <TextField
              label={en ? "New password" : "নতুন পাসওয়ার্ড"}
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              helperText={en ? "At least 6 characters" : "কমপক্ষে ৬ অক্ষর"}
              autoComplete="new-password"
            />
            <Button
              onClick={savePassword}
              disabled={pending || !cur || pw.length < 6}
              sx={{ alignSelf: { sm: "flex-start" } }}
            >
              {en ? "Change Password" : "পাসওয়ার্ড পরিবর্তন করুন"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Attendance SMS */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {en ? "Attendance SMS" : "উপস্থিতির SMS"}
          </Typography>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => toggle(e.target.checked)} disabled={smsPending} />}
            label={en ? "Enable attendance SMS" : "উপস্থিতির SMS চালু করুন"}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {en
              ? "When on, every student is sent an SMS each day as attendance is saved."
              : "চালু থাকলে প্রতিদিন উপস্থিতি সংরক্ষণের সময় প্রতিটি শিক্ষার্থীকে SMS পাঠানো হবে।"}
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            {en
              ? "With many students, daily attendance SMS can get expensive, so this is off by default. Payment SMS is always on."
              : "অনেক শিক্ষার্থী থাকলে প্রতিদিন উপস্থিতির SMS খরচ অনেক বেড়ে যেতে পারে। তাই এটি ডিফল্টভাবে বন্ধ থাকে। পেমেন্টের SMS সবসময় চালু থাকে।"}
          </Alert>
        </CardContent>
      </Card>
    </Stack>
  );
}
